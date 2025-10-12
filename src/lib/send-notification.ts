import { sendOutlookNotification } from './notifications';
import { sendGraphMail } from './graph-mail';
import { sendSimpleEmail } from './simple-email';

/**
 * Envía una notificación utilizando el mejor método disponible
 */
export async function sendNotificationEmail({
  to,
  subject,
  content,
  cc = [],
  bcc = [],
  recipientName = ''
}: {
  to: string;
  subject: string;
  content: string;
  cc?: string[];
  bcc?: string[];
  recipientName?: string;
}) {
  try {
    // Intenta primero con Outlook directo (más simple)
    try {
      console.log(`Enviando correo a ${to} usando Outlook directo`);
      const result = await sendOutlookNotification({
        to,
        subject,
        content
      });
      console.log('Correo enviado exitosamente con Outlook');
      return {
        success: true,
        method: 'outlook',
        id: result.id,
        recipientName
      };
    } catch (outlookError) {
      console.warn('Error con Outlook directo, intentando con Microsoft Graph:', outlookError);
      
      // Si falla, intenta con Microsoft Graph
      try {
        const result = await sendGraphMail({
          to,
          subject,
          content,
          cc,
          bcc
        });
        
        console.log('Correo enviado exitosamente con Microsoft Graph');
        return {
          success: true,
          method: 'graph',
          id: result.id,
          recipientName
        };
      } catch (graphError) {
        console.warn('Error con Microsoft Graph, intentando método simple:', graphError);
        
        // Si falla Graph también, usa el método simple
        const result = await sendSimpleEmail(to, subject, content);
        
        console.log('Correo procesado con método simple');
        return {
          success: true,
          method: 'simple',
          id: result.id,
          recipientName
        };
      }
    }
  } catch (error) {
    console.error('Error al enviar notificación por todos los métodos:', error);
    throw new Error(`No se pudo enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}