'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, get, push, serverTimestamp, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendNotificationEmail } from '@/lib/send-notification';
import { sendClientNotification } from '@/lib/client-notifications';
import { UserSchema, DebtSchema, User, Debt } from '@/lib/types';
import { logger } from '@/lib/logger';

// --- ZOD SCHEMAS ---
const NotificationOutputSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  content: z.string(),
  recipientName: z.string(),
});

const DebtNotificationPromptInputSchema = z.object({
  user: UserSchema,
  debt: DebtSchema,
});

// --- AI PROMPT for individual debt notification ---
const debtNotificationPrompt = ai.definePrompt({
  name: 'debtNotificationPrompt',
  input: { schema: DebtNotificationPromptInputSchema },
  output: { schema: NotificationOutputSchema },
  prompt: `
    Eres un asistente en el sistema de gestión del laboratorio de gastronomía de la Universidad LaSalle.
    Tu tarea es generar una notificación de cobro para un estudiante con un adeudo pendiente.

    DATOS DEL ADEUDO:
    - Estudiante: ${'JSON.stringify(user)'}
    - Adeudo: ${'JSON.stringify(debt)'}

    INSTRUCCIONES:
    1.  **Genera el contenido del correo de cobro:**
        *   **Asunto (subject):** Claro y directo. Ej: "Notificación de Adeudo Pendiente".
        *   **Nombre del destinatario (recipientName):** Usa el \`nombre\` completo del usuario.
        *   **Correo (to):** Usa el \`correo\` del usuario.
        *   **Contenido (content):** Escribe un mensaje en HTML profesional y formal.
            - Identifica al estudiante (\`user.nombre\`) y su matrícula (\`user.matricula\`).
            - Especifica el monto del adeudo (\`debt.monto\`) y el material relacionado (\`debt.nombreMaterial\`).
            - Insta al estudiante a realizar el pago lo antes posible para regularizar su situación.
  `,
});

// --- MAIN FLOW for notifying all users with debts ---
const DebtNotificationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  notificationsSent: z.number(),
});

export const debtNotificationFlow = ai.defineFlow(
  {
    name: 'debtNotificationFlow',
    outputSchema: DebtNotificationOutputSchema,
  },
  async () => {
    let notificationsSent = 0;
    try {
      const [debtsSnapshot, usersSnapshot] = await Promise.all([
        get(ref(db, 'adeudos')),
        get(ref(db, 'alumnos')),
      ]);

      const allDebts = debtsSnapshot.val() || {};
      const allUsers = usersSnapshot.val() || {};

      for (const debtId in allDebts) {
        const debtParseResult = DebtSchema.safeParse({ ...allDebts[debtId], id: debtId });

        if (!debtParseResult.success || debtParseResult.data.status !== 'pendiente') {
          if (!debtParseResult.success) {
            logger.chatbot('admin', 'invalid-debt-data', { debtId, error: debtParseResult.error }, 'warning');
          }
          continue;
        }
        const debt = debtParseResult.data;
        
        const user = Object.values(allUsers).find((u: any) => u.matricula === debt.matriculaAlumno) as User | undefined;
        if (!user) continue;

        const userParseResult = UserSchema.safeParse(user);
        if (!userParseResult.success) {
            logger.chatbot('admin', 'invalid-user-data-for-debt', { userId: user?.uid, error: userParseResult.error }, 'warning');
            continue;
        }
        const validUser = userParseResult.data;

        const { output: notification } = await debtNotificationPrompt({ user: validUser, debt });

        if (notification) {
          await sendNotificationEmail(notification);
          await sendClientNotification(notification);

          await push(ref(db, 'notificaciones'), {
            userId: validUser.uid,
            type: 'debt_notification',
            message: notification.content,
            subject: notification.subject,
            timestamp: serverTimestamp(),
            read: false,
          });
          notificationsSent++;
        }
      }

      return { success: true, message: `Proceso de notificación de adeudos completado. Se enviaron ${notificationsSent} notificaciones.`, notificationsSent };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        logger.error('admin', 'debt-notification-flow-error', { error: errorMessage });
        return { success: false, message: `No se pudo completar el flujo de notificación de adeudos: ${errorMessage}`, notificationsSent: 0 };
    }
  }
);
