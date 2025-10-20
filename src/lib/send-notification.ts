import { sendOutlookNotification } from './notifications';
import { sendGraphMail } from './graph-mail';

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
  // Verificar configuración de credenciales
  console.log('[Servidor] Verificando credenciales:');
  console.log(`- EMAIL_USER: ${process.env.EMAIL_USER ? 'Configurado' : 'No configurado'}`);
  console.log(`- EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? 'Configurado' : 'No configurado'}`);
  console.log(`- TENANT_ID: ${process.env.TENANT_ID ? 'Configurado' : 'No configurado'}`);
  console.log(`- CLIENT_ID: ${process.env.CLIENT_ID ? 'Configurado' : 'No configurado'}`);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('[Servidor] ADVERTENCIA: Credenciales de correo no configuradas correctamente');
  }
  
  try {
    // Intenta primero con Outlook directo (más simple)
    try {
      console.log(`[Servidor] Enviando correo a ${to} usando Outlook directo`);
      const result = await sendOutlookNotification({
        to,
        subject,
        content
      });
      console.log('[Servidor] Correo enviado exitosamente con Outlook');
      return {
        success: true,
        method: 'outlook',
        id: result.id,
        recipientName
      };
    } catch (outlookError) {
      console.warn('[Servidor] Error con Outlook directo:', outlookError);
      console.log('[Servidor] Intentando con Microsoft Graph...');
      
      // Si falla, intenta con Microsoft Graph
      const result = await sendGraphMail({
        to,
        subject,
        content,
        cc,
        bcc
      });
      
      console.log('[Servidor] Correo enviado exitosamente con Microsoft Graph');
      return {
        success: true,
        method: 'graph',
        id: result.id,
        recipientName
      };
    }
  } catch (error) {
    console.error('[Servidor] Error al enviar notificación por todos los métodos:', error);
    throw new Error(`No se pudo enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}