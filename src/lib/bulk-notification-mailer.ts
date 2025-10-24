'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { sendNotificationEmail } from '@/lib/send-notification';
import { sendClientNotification } from '@/lib/client-notifications';
import { Loan, Debt, User } from '@/lib/types';

// --- TYPE DEFINITIONS for the notification payload ---
export type NotificationPayload = 
  | { type: 'loanReminder'; recipient: User; loanDetails: Loan; }
  | { type: 'loanOverdue'; recipient: User; loanDetails: Loan; }
  | { type: 'newDebt'; recipient: User; debtDetails: Debt; }
  | { type: 'debtReminder'; recipient: User; debtDetails: Debt; };

// --- ZOD SCHEMAS for AI Interaction ---
const EmailContentSchema = z.object({
  subject: z.string().describe('El asunto del correo. Debe ser claro y conciso.'),
  htmlBody: z.string().describe('El contenido completo del correo en formato HTML.'),
});

const PromptInputSchema = z.object({ 
    notificationType: z.enum(['loanReminder', 'loanOverdue', 'newDebt', 'debtReminder']),
    studentName: z.string(),
    materialName: z.string().optional(),
    dueDate: z.string().optional(),
    debtAmount: z.number().optional(),
    imageUrl: z.string(),
  });

// --- THE AI PROMPT for generating HTML emails ---
const htmlEmailGeneratorPrompt = ai.definePrompt({
  name: 'htmlEmailGeneratorPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: EmailContentSchema },
  prompt: `
    Eres un asistente de comunicación para la Licenciatura en Gastronomía. Tu única tarea es generar correos electrónicos en formato HTML profesionales, amigables y visualmente atractivos.

    DATOS RECIBIDOS:
    - Tipo de Notificación: {{notificationType}}
    - Nombre del Alumno: {{studentName}}
    - Nombre del Material: {{materialName}}
    - Fecha de Devolución: {{dueDate}}
    - Monto del Adeudo: {{debtAmount}}
    - URL de la Imagen: {{imageUrl}}

    REGLAS DE DISEÑO Y CONTENIDO:
    1.  **ESTRUCTURA HTML:** Genera un HTML completo y válido. Usa una tabla para el layout principal para asegurar compatibilidad con clientes de correo como Outlook.
    2.  **ESTILO:** Usa CSS inline. El diseño debe ser limpio y moderno. Colores sugeridos: fondo #f9f9f9, texto #333, un acento de color #c0392b (rojo oscuro).
    3.  **IMAGEN:** La imagen ({{imageUrl}}) DEBE estar al final del contenido, centrada. Hazla responsive (width: 100%; max-width: 250px;).
    4.  **TONO Y MENSAJE:**
        -   **loanReminder (Recordatorio Amable):** Tono amigable. "Hola {{studentName}}, solo un recordatorio rápido de que tu préstamo del material '{{materialName}}' vence pronto, el día {{dueDate}}. ¡No lo olvides!"
        -   **loanOverdue (Préstamo Vencido):** Tono más serio pero aún profesional. "Hola {{studentName}}, hemos notado que el préstamo del material '{{materialName}}' que venció el {{dueDate}} aún no ha sido devuelto. Por favor, acércate al pañol para regularizar tu situación."
        -   **newDebt (Nuevo Adeudo):** Tono formal y directo. "Estimado/a {{studentName}}, te informamos que se ha generado un nuevo adeudo a tu nombre por no devolver el material '{{materialName}}'. El monto es de {{debtAmount}} MXN. Por favor, pasa a la brevedad a control escolar para liquidarlo."
        -   **debtReminder (Recordatorio de Adeudo):** Tono de recordatorio firme. "Estimado/a {{studentName}}, este es un recordatorio sobre tu adeudo pendiente de {{debtAmount}} MXN por el material '{{materialName}}'. Te pedimos que pases a control escolar para realizar el pago correspondiente."
    5.  **FIRMA:** Siempre finaliza con "Atentamente, Coordinación de Gastronomía, Universidad La Salle Nezahualcóyotl."

    TAREA: Basado en el tipo de notificación y los datos, genera el 'subject' y el 'htmlBody' como un objeto JSON válido.
  `,
});

/**
 * Orchestrates the generation and sending of bulk notifications.
 * @param payloads An array of NotificationPayload objects.
 */
export async function sendBulkHtmlNotifications(payloads: NotificationPayload[]) {
  const imageUrl = 'https://firebasestorage.googleapis.com/v0/b/bdsql-9416f.appspot.com/o/rep.gif?alt=media';

  for (const payload of payloads) {
    try {
      let promptInput: z.infer<typeof PromptInputSchema>;

      if ('loanDetails' in payload) {
        promptInput = {
          notificationType: payload.type,
          studentName: payload.recipient.nombre,
          materialName: payload.loanDetails.nombreMaterial,
          dueDate: payload.loanDetails.fechaLimite,
          imageUrl,
        };
      } else {
        promptInput = {
          notificationType: payload.type,
          studentName: payload.recipient.nombre,
          materialName: payload.debtDetails.nombreMaterial,
          debtAmount: payload.debtDetails.monto,
          imageUrl,
        };
      }

      const { output: emailContent } = await htmlEmailGeneratorPrompt(promptInput);

      if (!emailContent) {
        throw new Error('AI failed to generate email content.');
      }
      
      const notificationData = {
        to: payload.recipient.correo,
        subject: emailContent.subject,
        content: emailContent.htmlBody,
        recipientName: payload.recipient.nombre,
        userId: payload.recipient.uid,
      };

      await Promise.all([
        sendNotificationEmail(notificationData),
        sendClientNotification(notificationData),
        push(ref(db, 'notificaciones'), {
            userId: payload.recipient.uid,
            type: `auto_${payload.type}`,
            message: emailContent.htmlBody,
            subject: emailContent.subject,
            timestamp: serverTimestamp(),
            read: false,
        })
      ]);

      logger.action('system', `notification-sent-${payload.type}`, { student: payload.recipient.matricula });

    } catch (error) {
      logger.error('system', `bulk-mailer-failed-for-payload`, error, { payload });
    }
  }
}
