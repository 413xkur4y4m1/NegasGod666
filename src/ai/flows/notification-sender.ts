'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendNotificationEmail } from '@/lib/send-notification';
import { ref, get, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendClientNotification } from '@/lib/client-notifications';
import { logger } from '@/lib/logger';
import { debtNotificationFlow } from './debt-notification';
import { loanReminderNotificationFlow } from './automated-loan-reminders';

//----------- INPUT/OUTPUT SCHEMAS -----------------

const NotificationSenderInputSchema = z.object({
  userQuery: z.string().describe('La instrucción del administrador sobre qué notificar.'),
});

const NotificationSenderOutputSchema = z.object({
    response: z.string().describe('Respuesta final para el administrador, resumiendo el resultado de la acción.'),
});

//----------- 1. DISPATCHER: Clasifica la intención del usuario -----------------

const DispatcherOutputSchema = z.object({
  action: z.enum(['single_user', 'all_debts', 'all_loans', 'unknown'])
    .describe("Clasifica la petición: notificar a un usuario, a todos los deudores, a todos con préstamos, o si no está claro."),
});

const dispatcherPrompt = ai.definePrompt({
  name: 'notificationDispatcherPrompt',
  input: { schema: NotificationSenderInputSchema },
  output: { schema: DispatcherOutputSchema },
  prompt: `Eres un clasificador de intenciones. Analiza la petición del administrador y determina el tipo de notificación que desea enviar.

  - Si la petición es para un usuario específico (ej: "mándale a Juan", "recuérdale a Ana"), clasifícalo como 'single_user'.
  - Si la petición es sobre "adeudos" o "deudores" de forma masiva (ej: "notifica a los deudores", "envía los adeudos"), clasifícalo como 'all_debts'.
  - Si la petición es sobre "préstamos" de forma masiva (ej: "recuerda a todos sobre sus préstamos"), clasifícalo como 'all_loans'.
  - Si no estás seguro o la petición es ambigua, clasifícalo como 'unknown'.

  Petición: {{{userQuery}}}`,
});

//---------- 2. SPECIALIST: Genera notificaciones para un solo usuario -----------------

const SingleUserNotificationSchema = z.object({
    response: z.string().describe('Mensaje de confirmación para el administrador.'),
    notification: z.object({
      to: z.string().email(),
      subject: z.string(),
      content: z.string(),
      recipientName: z.string(),
      userId: z.string(),
    }).optional(),
});

const singleNotificationPrompt = ai.definePrompt({
  name: 'singleNotificationPrompt',
  input: { schema: z.object({ userQuery: z.string(), context: z.any() }) },
  output: { schema: SingleUserNotificationSchema },
  prompt: `Eres un asistente de IA para redactar notificaciones. Analiza la petición y el contexto (usuarios y préstamos) para identificar al destinatario y redactar un correo HTML claro y profesional.

  **REGLAS:**
  - Si no puedes identificar a un destinatario único, responde en el campo 'response' que la petición no fue clara.
  - Si identificas al destinatario, genera el objeto 'notification' con todos sus campos (to, subject, content, recipientName, userId).

  Contexto: {{{JSON.stringify(context)}}}
  Petición: {{{userQuery}}}`
});

async function handleSingleUserNotification(userQuery: string): Promise<z.infer<typeof NotificationSenderOutputSchema>> {
    const [loansSnapshot, usersSnapshot] = await Promise.all([
        get(ref(db, 'prestamos')),
        get(ref(db, 'alumnos')),
    ]);
    const context = { loans: loansSnapshot.val() || {}, users: usersSnapshot.val() || {} };

    const { output } = await singleNotificationPrompt({ userQuery, context });

    if (!output?.notification?.userId) {
        logger.chatbot('admin', 'ia-no-single-user-id', { userQuery, output }, 'warning');
        return { response: output?.response || "No pude identificar a un destinatario único en tu solicitud." };
    }

    const { notification } = output;
    await sendNotificationEmail(notification);
    await sendClientNotification(notification);
    await push(ref(db, 'notificaciones'), {
        userId: notification.userId,
        type: 'manual_admin',
        message: notification.content,
        subject: notification.subject,
        timestamp: serverTimestamp(),
        read: false,
    });

    return { response: output.response };
}

//----------- 3. MAIN FLOW: El Despachador Inteligente -----------------

const notificationSenderFlow = ai.defineFlow(
  {
    name: 'notificationSenderFlow',
    inputSchema: NotificationSenderInputSchema,
    outputSchema: NotificationSenderOutputSchema,
  },
  async ({ userQuery }) => {
    logger.action('system', 'notification-dispatcher-start', { userQuery }, 'info');

    const { output: dispatcherResult } = await dispatcherPrompt({ userQuery });

    if (!dispatcherResult) {
      logger.error('system', 'dispatcher-null-result', new Error('El prompt del despachador devolvió nulo'), { userQuery });
      return { response: "Error: No se pudo determinar la intención de la notificación." };
    }

    switch (dispatcherResult.action) {
      case 'single_user':
        logger.action('system', 'dispatching-to-single-user', { userQuery }, 'info');
        return await handleSingleUserNotification(userQuery);

      case 'all_debts':
        logger.action('system', 'dispatching-to-all-debts', { userQuery }, 'info');
        const debtResult = await debtNotificationFlow();
        return { response: debtResult.message };

      case 'all_loans':
        logger.action('system', 'dispatching-to-all-loans', { userQuery }, 'info');
        const loanResult = await loanReminderNotificationFlow({});
        return { response: loanResult.message };

      case 'unknown':
      default:
        logger.chatbot('admin', 'dispatcher-unknown-intent', { userQuery }, 'warning');
        return { response: "No estoy seguro de qué tipo de notificación quieres enviar. Por favor, sé más específico. Puedes pedirme notificar a una persona, a todos los deudores, o a todos los que tienen préstamos." };
    }
  }
);

//----------- 4. EXPORTED FUNCTION: Punto de entrada con manejo de errores -----------------

export async function sendNotification(input: z.infer<typeof NotificationSenderInputSchema>): Promise<z.infer<typeof NotificationSenderOutputSchema>> {
  try {
    return await notificationSenderFlow(input);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('admin', 'notification-flow-critical-error', error, { userQuery: input.userQuery });
    return {
        response: `Ocurrió un error crítico al procesar tu solicitud. El sistema podría estar experimentando problemas. Detalles: ${errorMessage}`
    };
  }
}
