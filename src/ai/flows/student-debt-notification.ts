
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendNotificationEmail } from '@/lib/send-notification';
import { ref, get, push, serverTimestamp, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendClientNotification } from '@/lib/client-notifications';

// Esquema para la salida de la notificación generada por IA
const NotificationOutputSchema = z.object({
  to: z.string().describe('Correo del destinatario'),
  subject: z.string().describe('Asunto del correo'),
  content: z.string().describe('Contenido HTML del correo'),
  recipientName: z.string().describe('Nombre del destinatario'),
});

// Esquema para la entrada del prompt de IA
const DebtPromptInputSchema = z.object({
  user: z.any().describe('Objeto del usuario desde Firebase'),
  loan: z.any().describe('Objeto del préstamo desde Firebase'),
  // FIX: Especificamos .int() para evitar incompatibilidades de esquema con la API de Google.
  diffDays: z.number().int().describe('Días hasta el vencimiento (positivo) o días de retraso (negativo/cero)'),
});

// Definición del Prompt de Genkit
const debtNotificationPrompt = ai.definePrompt({
  name: 'debtNotificationPrompt',
  input: { schema: DebtPromptInputSchema },
  output: { schema: NotificationOutputSchema },
  prompt: `
    Eres un asistente en el sistema de préstamos de la biblioteca de LaSalle.
    Tu tarea es generar un recordatorio sobre un préstamo.

    DATOS DEL PRÉSTAMO:
    - Estudiante: \${JSON.stringify(user)}
    - Préstamo: \${JSON.stringify(loan)}
    - Días para vencer/vencido: \${diffDays}

    INSTRUCCIONES:
    1.  **Analiza \`diffDays\`:**
        *   Si \`diffDays\` es positivo, es un recordatorio de "próximo vencimiento".
        *   Si \`diffDays\` es cero o negativo, es una notificación de "préstamo vencido".

    2.  **Genera el contenido:**
        *   **Asunto (subject):** Crea un asunto claro y conciso. Ej: "Recordatorio de Préstamo" o "Aviso de Préstamo Vencido".
        *   **Nombre del destinatario (recipientName):** Usa el nombre completo del usuario.
        *   **Correo (to):** Usa el email del usuario.
        *   **Contenido (content):** Escribe un mensaje en HTML. Sé profesional y amable.
            - Menciona el nombre del estudiante, el nombre del material prestado (\`loan.materialName\`).
            - Si es un recordatorio, indica cuántos días quedan.
            - Si está vencido, indica cuántos días de retraso tiene.
            - Anima al estudiante a devolver el material pronto.
  `,
});


// Esquema para la entrada del flujo principal
const StudentDebtNotificationInputSchema = z.object({
  userId: z.string().optional().describe('El ID del usuario a notificar (opcional, para notificar a uno solo)'),
});

// Esquema para la salida del flujo principal
const StudentDebtNotificationOutputSchema = z.object({
  response: z.string().describe('Confirmación del envío o mensaje de error'),
});

export type StudentDebtNotificationInput = z.infer<typeof StudentDebtNotificationInputSchema>;

// El Flujo principal de Genkit
export const studentDebtNotificationFlow = ai.defineFlow(
  {
    name: 'studentDebtNotificationFlow',
    inputSchema: StudentDebtNotificationInputSchema,
    outputSchema: StudentDebtNotificationOutputSchema,
  },
  async ({ userId }) => {
    try {
      const loansRef = ref(db, 'prestamos');
      const usersRef = ref(db, 'usuarios');
      const notificationsRef = ref(db, 'notificaciones');

      const [loansSnapshot, usersSnapshot] = await Promise.all([
        get(loansRef),
        get(usersRef),
      ]);

      const loans = loansSnapshot.val() || {};
      const users = usersSnapshot.val() || {};
      const now = new Date();

      for (const loanId in loans) {
        const loan = loans[loanId];
        const studentId = loan.studentId;

        if (userId && studentId !== userId) {
          continue; // Si se busca un usuario específico, ignorar los demás
        }

        const user = users[studentId];
        if (!user || loan.status !== 'prestado') {
          continue;
        }

        const dueDate = new Date(loan.dueDate);
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const needsNotification = diffDays <= 3; // Notificar si faltan 3 días o menos, o si ya está vencido

        if (needsNotification) {
          const notificationType = diffDays <= 0 ? 'overdue' : 'due_soon';

          // Evitar spam: no enviar si ya se envió una del mismo tipo en las últimas 24h
          const recentNotifsQuery = query(
            notificationsRef,
            orderByChild('userId'),
            equalTo(studentId),
            limitToLast(1)
          );
          const recentNotifsSnapshot = await get(recentNotifsQuery);

          let shouldSend = true;
          if (recentNotifsSnapshot.exists()) {
            const lastNotif = Object.values(recentNotifsSnapshot.val())[0] as any;
             if (lastNotif.type === notificationType) {
              const lastNotifTime = lastNotif.timestamp;
              const hoursSince = (Date.now() - lastNotifTime) / (1000 * 60 * 60);
              if (hoursSince < 24) {
                shouldSend = false;
              }
            }
          }

          if (shouldSend) {
            // ¡Aquí es donde la IA genera el mensaje!
            const { output: notification } = await debtNotificationPrompt({
              user,
              loan,
              diffDays,
            });

            if (notification) {
              // 1. Enviar notificación por correo (Outlook)
              await sendNotificationEmail(notification);

              // 2. Enviar notificación a la interfaz del estudiante
              await sendClientNotification({ ...notification, userId: studentId } as any);

              // 3. Guardar la notificación en la base de datos para el historial
              await push(notificationsRef, {
                userId: studentId,
                type: notificationType,
                message: notification.content, // Guardamos el HTML generado
                subject: notification.subject,
                timestamp: serverTimestamp(),
                read: false,
              });
            }
          }
        }
      }

      return { response: 'Proceso de notificación de deudas completado.' };
    } catch (error) {
      console.error('Error en el flujo de notificación de deudas:', error);
      throw new Error(`No se pudo completar el flujo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
);
