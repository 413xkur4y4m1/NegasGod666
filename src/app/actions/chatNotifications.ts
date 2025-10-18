
'use server';

import { sendNotification } from '@/ai/flows/notification-sender';

interface NotificationPayload {
  input: string;
}

export async function processAdminChatNotification({ input }: NotificationPayload): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    console.log(`[ProcessNotification] Procesando solicitud: "${input}"`);

    // Call the Genkit flow to generate and send the notification
    const result = await sendNotification({
      userQuery: input,
    });

    return {
      success: true,
      message: result.response,
    };

  } catch (error) {
    console.error('[ProcessNotification] Error general:', error);
    return {
      success: false,
      message: 'Ocurrió un error inesperado al procesar la notificación.',
    };
  }
}
