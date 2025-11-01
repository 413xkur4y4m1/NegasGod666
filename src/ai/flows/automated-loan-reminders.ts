'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, get, push, serverTimestamp, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendNotificationEmail } from '@/lib/send-notification';
import { sendClientNotification } from '@/lib/client-notifications';
import { User, Loan, UserSchema, LoanSchema } from '@/lib/types';
import { logger } from '@/lib/logger';

// NOTE: The file name is misleading. This flow handles LOAN REMINDERS, not debts.

// --- ZOD SCHEMAS ---
const NotificationOutputSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  content: z.string(),
  recipientName: z.string(),
});

const LoanReminderPromptInputSchema = z.object({
  user: UserSchema,
  loan: LoanSchema,
  diffDays: z.number().int(),
});

// --- AI PROMPT ---
const loanReminderPrompt = ai.definePrompt({
  name: 'loanReminderPrompt',
  input: { schema: LoanReminderPromptInputSchema },
  output: { schema: NotificationOutputSchema },
  prompt: `
    Eres un asistente en el sistema de préstamos del laboratorio de gastronomía de la Universidad LaSalle.
    Tu tarea es generar un recordatorio sobre un préstamo, basándote en los días que faltan para su vencimiento o los días que lleva de retraso.

    DATOS DEL PRÉSTAMO:
    - Estudiante: ${'JSON.stringify(user)'}
    - Préstamo: ${'JSON.stringify(loan)'}
    - Días para vencer/vencido: ${'diffDays'}

    INSTRUCCIONES:
    1.  **Analiza \`diffDays\`:**
        *   Si es positivo, es un recordatorio de "próximo vencimiento".
        *   Si es cero o negativo, es una notificación de "préstamo vencido".

    2.  **Genera el contenido del correo:**
        *   **Asunto (subject):** Claro y conciso. Ej: "Recordatorio de Préstamo" o "Aviso de Préstamo Vencido".
        *   **Nombre del destinatario (recipientName):** Usa el \`nombre\` completo del usuario.
        *   **Correo (to):** Usa el \`correo\` del usuario.
        *   **Contenido (content):** Escribe un mensaje en HTML profesional y amable.
            - Menciona el nombre del estudiante (\`user.nombre\`).
            - Menciona el material prestado (\`loan.nombreMaterial\`).
            - Si es un recordatorio, indica los días que quedan (\`diffDays\`).
            - Si está vencido, indica los días de retraso (el valor absoluto de \`diffDays\`).
            - Anima al estudiante a devolver el material lo antes posible.
  `,
});

// --- MAIN FLOW ---
const LoanReminderInputSchema = z.object({
  userId: z.string().optional().describe('Opcional. El ID del usuario a notificar para un recordatorio específico.'),
});

const LoanReminderOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  notificationsSent: z.number(),
});

export const loanReminderNotificationFlow = ai.defineFlow(
  {
    name: 'loanReminderNotificationFlow',
    inputSchema: LoanReminderInputSchema,
    outputSchema: LoanReminderOutputSchema,
  },
  async ({ userId }) => {
    let notificationsSent = 0;
    try {
      const [loansSnapshot, usersSnapshot] = await Promise.all([
        get(ref(db, 'prestamos')),
        get(ref(db, 'alumnos')), 
      ]);

      const allLoans = loansSnapshot.val() || {};
      const allUsers = usersSnapshot.val() || {};
      const now = new Date();

      for (const loanId in allLoans) {
        const loanParseResult = LoanSchema.safeParse({ ...allLoans[loanId], idPrestamo: loanId });
        if (!loanParseResult.success) {
            logger.chatbot('admin', 'invalid-loan-data', { loanId, error: loanParseResult.error }, 'warning');
            continue; 
        }
        const loan = loanParseResult.data;

        const user = Object.values(allUsers).find((u: any) => u.matricula === loan.matriculaAlumno) as User | undefined;
        if (!user || (userId && user.uid !== userId)) {
          continue;
        }
        
        const userParseResult = UserSchema.safeParse(user);
        if (!userParseResult.success || loan.status !== 'activo') {
            if (!userParseResult.success) logger.chatbot('admin', 'invalid-user-data', { userId: user?.uid, error: userParseResult.error }, 'warning');
            continue;
        }
        const validUser = userParseResult.data;

        const dueDate = new Date(loan.fechaLimite);
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
          const notificationType = diffDays <= 0 ? 'overdue_loan' : 'due_soon_loan';
          
          const recentNotifsQuery = query(ref(db, 'notificaciones'), orderByChild('userId'), equalTo(validUser.uid), limitToLast(5));
          const recentNotifsSnapshot = await get(recentNotifsQuery);
          let shouldSend = true;

          if (recentNotifsSnapshot.exists()) {
            const lastNotifs = Object.values(recentNotifsSnapshot.val()) as any[];
            const hasRecentSimilarNotif = lastNotifs.some(notif => 
                notif.type === notificationType &&
                (Date.now() - notif.timestamp) / (1000 * 60 * 60) < 24
            );
            if (hasRecentSimilarNotif) {
                shouldSend = false;
            }
          }

          if (shouldSend) {
            const { output: notification } = await loanReminderPrompt({ user: validUser, loan, diffDays });

            if (notification) {
              // CORRECCIÓN: Añadir el 'userId' al objeto de notificación antes de enviarlo.
              const notificationPayload = { ...notification, userId: validUser.uid };

              await sendNotificationEmail(notificationPayload);
              await sendClientNotification(notificationPayload);

              await push(ref(db, 'notificaciones'), {
                userId: validUser.uid,
                type: notificationType,
                message: notification.content,
                subject: notification.subject,
                timestamp: serverTimestamp(),
                read: false,
              });
              notificationsSent++;
            }
          }
        }
      }

      return { success: true, message: `Proceso de recordatorios de préstamos completado. Se enviaron ${notificationsSent} notificaciones.`, notificationsSent };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        logger.error('admin', 'loan-reminder-flow-error', { error: errorMessage });
        return { success: false, message: `No se pudo completar el flujo: ${errorMessage}`, notificationsSent: 0 };
    }
  }
);
