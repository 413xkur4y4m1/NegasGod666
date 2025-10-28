'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { debtNotificationFlow } from '@/ai/flows/debt-notification';
import { manageMaterial } from '@/ai/flows/admin-chatbot-material-management';
import { logger } from '@/lib/logger';
import { LoanSchema, UserSchema, MaterialSchema } from '@/lib/types';

// Simplificamos las intenciones. O es una notificación masiva de deudas, o es cualquier otra cosa que el sub-flujo maneja.
const IntentSchema = z.object({
  intent: z.enum([
    'SEND_DEBT_NOTIFICATION', // Para notificar a TODOS los que tienen adeudos.
    'MANAGE_SYSTEM',          // Para cualquier otra consulta: preguntas, añadir material, notificar a UN individuo.
    'NONE'
  ]).describe('La acción principal que el administrador quiere ejecutar.'),
});

const intentDetector = ai.definePrompt({
  name: 'intentDetector',
  input: { schema: z.object({ userQuery: z.string() }) },
  output: { schema: IntentSchema },
  prompt: `Eres un enrutador de IA de alto nivel. Tu única tarea es clasificar la intención del administrador en una de dos categorías, sin ambigüedad.

  Posibles Intenciones:
  - 'SEND_DEBT_NOTIFICATION': El administrador quiere enviar una notificación masiva a TODOS los estudiantes con ADEUDOS. La consulta debe contener palabras clave como "todos", "deudores", "quienes deben".
    - Ejemplo: "notifica a todos los deudores", "avisa a los que deben material".

  - 'MANAGE_SYSTEM': Para CUALQUIER OTRA solicitud. Esto incluye:
    - Enviar una notificación a UN SOLO individuo (Ej: "recuérdale a Daniel Alejandro sobre su préstamo").
    - Añadir o actualizar material (Ej: "añade 10 cuchillos").
    - Hacer una pregunta (Ej: "¿cuántos tenedores hay?").

  - 'NONE': La solicitud no es clara o no encaja en ninguna categoría.

  Solicitud del Usuario:
  "{{{userQuery}}}"`,
});

export const mainRouterFlow = ai.defineFlow(
  {
    name: 'mainRouterFlow',
    inputSchema: z.object({ userQuery: z.string() }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ userQuery }) => {
    try {
      const { output } = await intentDetector({ userQuery });
      
      if (!output) {
        throw new Error("La IA para detectar la intención no produjo una salida.");
      }

      const { intent } = output;
      logger.chatbot('admin', 'intent-detected', { intent });

      switch (intent) {
        case 'SEND_DEBT_NOTIFICATION': {
          const { success, message } = await debtNotificationFlow();
          return { success, message };
        }

        // Unificamos el resto de las acciones bajo este caso.
        case 'MANAGE_SYSTEM':
          try {
            // Obtenemos todo el contexto necesario para el sub-flujo.
            const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
              get(ref(db, 'prestamos')),
              get(ref(db, 'alumnos')),
              get(ref(db, 'materiales')),
            ]);

            const context = {
              loans: JSON.stringify(loansSnapshot.val() || {}),
              users: JSON.stringify(usersSnapshot.val() || {}),
              materials: JSON.stringify(materialsSnapshot.val() || {}),
            };

            // Delegamos la lógica completa al flujo de gestión.
            const queryResult = await manageMaterial({ userQuery, context });
            return { success: true, message: queryResult.response };

          } catch (dbError) {
            logger.error('admin', 'manage-system-db-error', dbError);
            return { success: false, message: 'Error al consultar los datos del sistema para procesar tu solicitud.' };
          }

        case 'NONE':
        default:
          return { success: false, message: 'No he podido identificar una acción clara en tu solicitud. ¿Podrías reformularla?' };
      }
    } catch (error) {
        logger.error('admin', 'main-router-failed', { message: error instanceof Error ? error.message : String(error) });
         return {
            success: false,
            message: 'Lo siento, un error crítico me impidió procesar tu solicitud. El equipo técnico ha sido notificado.'
        };
    }
  }
);
