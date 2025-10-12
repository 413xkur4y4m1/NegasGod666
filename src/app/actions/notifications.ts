'use server';

import { sendNotificationEmail } from '@/lib/send-notification';

/**
 * Acción del servidor para enviar notificaciones
 * Esta función solo se ejecutará en el lado del servidor
 */
export async function sendServerNotification({
  to,
  subject,
  content,
  recipientName = '',
  cc = [],
  bcc = []
}: {
  to: string;
  subject: string;
  content: string;
  recipientName?: string;
  cc?: string[];
  bcc?: string[];
}) {
  try {
    const result = await sendNotificationEmail({
      to,
      subject,
      content,
      recipientName,
      cc,
      bcc
    });
    
    return {
      success: true,
      method: result.method,
      id: result.id,
      recipientName: result.recipientName
    };
  } catch (error) {
    console.error('Error al enviar notificación desde el servidor:', error);
    throw new Error(`No se pudo enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}