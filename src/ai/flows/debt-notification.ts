import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { UserSchema, DebtSchema } from '@/lib/types';
import { sendNotificationEmail } from '@/lib/send-notification';

const DebtNotificationInput = z.object({
  debtor: UserSchema,
  debt: DebtSchema,
});

const DebtNotificationResponse = z.object({
  shouldNotify: z.boolean().describe('Indica si se debe notificar al deudor'),
  subject: z.string().optional().describe('El asunto del correo de notificación'),
  content: z.string().optional().describe('El contenido HTML del correo de notificación'),
});

export const debtNotificationFlow = ai.defineFlow(
  {
    name: 'debtNotificationFlow',
    inputSchema: DebtNotificationInput,
    outputSchema: z.void(),
  },
  async ({ debtor, debt }) => {
    const prompt = `
      Eres un asistente de gestión de deudas para el sistema de inventario de una universidad.
      Tu tarea es evaluar el siguiente caso y decidir si se debe enviar una notificación de cobro.
      Genera un asunto y un correo electrónico profesional y amigable si decides notificar.

      Contexto:
      - Deudor: ${JSON.stringify(debtor, null, 2)}
      - Deuda: ${JSON.stringify(debt, null, 2)}

      Reglas:
      - Solo notifica si el estado de la deuda es 'pendiente'.
      - Si el monto es mayor a $100, el tono debe ser más urgente.
      - Si ya se han enviado notificaciones previas, recuérdalo en el correo.
      - El correo debe ser en formato HTML.

      Responde en formato JSON con las claves:
      {
        "shouldNotify": boolean,
        "subject": string,
        "content": string
      }
    `;

    // Llamada al modelo
    const llmResponse = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      prompt,
      output: {
        schema: DebtNotificationResponse,
      },
    });

    const result = llmResponse.output;

    // ✅ Verificación segura contra null o undefined
    if (result && result.shouldNotify && result.subject && result.content) {
      console.log(`[Flow] Enviando notificación a ${debtor.correo}...`);

      await sendNotificationEmail({
        to: debtor.correo,
        subject: result.subject,
        content: result.content,
        userId: debtor.uid,
      });

      console.log(`[Flow] Notificación enviada correctamente a ${debtor.correo}`);
    } else {
      console.log(`[Flow] No se requiere enviar notificación o la respuesta fue inválida para ${debtor.correo}`);
    }
  }
);
