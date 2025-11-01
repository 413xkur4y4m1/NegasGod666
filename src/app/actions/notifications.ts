'use server';

import { sendNotificationEmail } from '@/lib/send-notification';

/**
 * Acción del servidor para enviar notificaciones.
 * Esta función solo se ejecutará en el lado del servidor.
 */
export async function sendServerNotification({
  to,
  subject,
  content,
  userId, // <-- CORREGIDO: Se añade el userId que es requerido
}: {
  to: string;
  subject: string;
  content: string;
  userId: string; // <-- CORREGIDO: Se añade el userId al tipo
}) {
  try {
    // CORREGIDO: Se llama a la función con los parámetros correctos.
    // Se eliminan `recipientName`, `cc` y `bcc` que no son aceptados.
    const result = await sendNotificationEmail({
      to,
      subject,
      content,
      userId,
    });
    
    // CORREGIDO: Se ajusta la respuesta a lo que realmente devuelve `sendNotificationEmail`.
    if (result.success) {
      return {
        success: true,
        provider: result.provider,
        id: result.id,
      };
    } else {
      // Si el envío falló, se propaga el error.
      throw new Error(result.error || 'Error desconocido al enviar la notificación.');
    }

  } catch (error) {
    console.error('Error al enviar notificación desde el servidor:', error);
    throw new Error(`No se pudo enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}
