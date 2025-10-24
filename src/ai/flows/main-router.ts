
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { createMaterialAction } from '@/app/actions/createMaterial';
import { loanReminderNotificationFlow } from '@/ai/flows/student-debt-notification';
import { debtNotificationFlow } from '@/ai/flows/debt-notification';
import { manageMaterial } from '@/ai/flows/admin-chatbot-material-management';
import { logger } from '@/lib/logger';
import { UserSchema, LoanSchema, MaterialSchema, User } from '@/lib/types';

const IntentSchema = z.object({
  intent: z.enum([
    'SEND_LOAN_REMINDER',
    'SEND_DEBT_NOTIFICATION',
    'CREATE_MATERIAL',
    'QUERY_DATA',
    'NONE'
  ]).describe('La acción principal que el usuario quiere ejecutar.'),
  userName: z.string().optional().describe('Si la intención es notificar a alguien, este es el nombre del usuario.'),
});

const intentDetector = ai.definePrompt({
  name: 'intentDetector',
  input: { schema: z.object({ userQuery: z.string() }) },
  output: { schema: IntentSchema },
  prompt: `Eres un experto en clasificar la intención de un administrador. Analiza la solicitud y determina la acción precisa y realizala la o acciones que solicita el admin.

  Posibles Intenciones:
  - 'SEND_LOAN_REMINDER': El usuario quiere ENVIAR, MANDAR o generar un RECORDATORIO sobre un PRÉSTAMO a (Nombre del alumno que el admin haya puesto). Ej: "mándale un recordatorio a (Nombre de cualquier alumno que el admin silicitó)", "recuérdale a Maria sobre su préstamo".
  - 'SEND_DEBT_NOTIFICATION': El usuario quiere ENVIAR o MANDAR una notificación masiva a TODOS los estudiantes con ADEUDOS. Ej: "notifica a todos los deudores", "avisa a los que deben dinero".
  - 'CREATE_MATERIAL': El usuario quiere AÑADIR, CREAR o REGISTRAR un nuevo material. Ej: "agrega 10 cuchillos de chef".
  - 'QUERY_DATA': El usuario está haciendo una PREGUNTA, buscando información, o quiere VER datos. Ej: "busca los préstamos de (Cualquier nombre de alumno que el admin ponga)", "quién debe material", "cuántos cuchillos hay".
  - 'NONE': La solicitud no encaja en ninguna categoría.

  Instrucción Adicional:
  - Si la intención es 'SEND_LOAN_REMINDER', extrae el nombre del estudiante y ponlo en el campo 'userName'.

  Solicitud del Usuario:
  "{$userQuery}"`,
});

export const mainRouterFlow = ai.defineFlow(
  {
    name: 'mainRouterFlow',
    inputSchema: z.object({ userQuery: z.string() }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      details: z.any().optional(),
    }),
  },
  async ({ userQuery }) => {
    try {
      const { output } = await intentDetector({ userQuery });
      
      const validationResult = IntentSchema.safeParse(output);
      if (!validationResult.success) {
        const validationError = new Error("La respuesta de la IA para detectar la intención no tiene el formato esperado.");
        (validationError as any).invalidResponse = output; 
        (validationError as any).zodIssues = validationResult.error.issues;
        throw validationError;
      }

      const { intent, userName } = validationResult.data;
      logger.chatbot('admin', 'intent-detected', { intent, userName });

      switch (intent) {
        case 'SEND_LOAN_REMINDER': {
          if (!userName) {
            return { success: false, message: 'Por favor, dime el nombre del estudiante al que quieres enviarle un recordatorio.' };
          }

          const usersSnapshot = await get(ref(db, 'alumno'));
          const allUsers = Object.values(usersSnapshot.val() || {})
              .map(u => UserSchema.safeParse(u))
              .filter(p => p.success)
              .map(p => (p as any).data);
          
          const foundUsers = allUsers.filter(user =>
            user.nombre.toLowerCase().includes(userName.toLowerCase())
          );

          if (foundUsers.length === 0) {
            return { success: false, message: `No encontré ningún usuario con el nombre "${userName}". Intenta con un nombre más completo.` };
          }

          if (foundUsers.length > 1) {
            const userNames = foundUsers.map(u => u.nombre).join(', ');
            return { success: false, message: `Encontré varios usuarios con ese nombre: ${userNames}. ¿A cuál te refieres?` };
          }

          const targetUser = foundUsers[0];
          const { success: reminderSuccess, message: reminderMessage } = await loanReminderNotificationFlow({ userId: targetUser.matricula });
          return { success: reminderSuccess, message: `Se ha iniciado el proceso de recordatorio para ${targetUser.nombre}. Resultado: ${reminderMessage}` };
        }

        case 'SEND_DEBT_NOTIFICATION': {
          const { success: debtSuccess, message: debtMessage } = await debtNotificationFlow();
          return { success: debtSuccess, message: debtMessage };
        }

        case 'CREATE_MATERIAL':
          return await createMaterialAction({ input: userQuery });

        case 'QUERY_DATA':
          try {
            const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
              get(ref(db, 'prestamos')),
              get(ref(db, 'alumno')),
              get(ref(db, 'materiales')),
            ]);

            const parsedLoans = Object.values(loansSnapshot.val() || {}).map(l => LoanSchema.safeParse(l)).filter(p => p.success).map(p => (p as any).data);
            const parsedUsers = Object.values(usersSnapshot.val() || {}).map(u => UserSchema.safeParse(u)).filter(p => p.success).map(p => (p as any).data);
            const parsedMaterials = Object.entries(materialsSnapshot.val() || {}).map(([id, m]) => MaterialSchema.safeParse({ id, ...(m as object) })).filter(p => p.success).map(p => (p as any).data);

            const context = {
              loans: JSON.stringify(parsedLoans),
              users: JSON.stringify(parsedUsers),
              materials: JSON.stringify(parsedMaterials),
            };

            const queryResult = await manageMaterial({ userQuery, context });
            return { success: true, message: queryResult.response };
          } catch (dbError) {
            logger.error('admin', 'query-data-db-error', dbError);
            return { success: false, message: 'Error al consultar los datos de la base de datos.' };
          }

        case 'NONE':
        default:
          return { success: false, message: 'No he podido identificar una acción clara en tu solicitud. ¿Podrías reformularla?' };
      }
    } catch (error) {
        console.error("\n--- ERROR EN MAIN ROUTER FLOW (ADMIN) ---");
        console.error(error);
        console.error("------------------------------------------\n");

        let errorDetails: any = { message: error instanceof Error ? error.message : String(error) };
        if ((error as any).invalidResponse) errorDetails.invalidResponse = (error as any).invalidResponse;
        if ((error as any).zodIssues) errorDetails.zodIssues = (error as any).zodIssues;

        logger.error('admin', 'main-router-failed', errorDetails);

        return {
            success: false,
            message: 'Lo siento, un error crítico me impidió procesar tu solicitud. El equipo técnico ha sido notificado.'
        };
    }
  }
);
