import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

/**
 * Envía un correo electrónico utilizando Microsoft Graph API con autenticación segura por credenciales de cliente.
 */
export async function sendGraphMail({
  to,
  subject,
  content,
  cc = [],
  bcc = []
}: {
  to: string | string[];
  subject: string;
  content: string;
  cc?: string[];
  bcc?: string[];
}) {
  try {
    // Validar las credenciales requeridas para el flujo de credenciales de cliente
    if (!process.env.TENANT_ID || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.EMAIL_USER) {
      throw new Error('Las credenciales de autenticación para Microsoft Graph no están configuradas correctamente.');
    }

    // Usar el proveedor de credenciales de cliente
    const credential = new ClientSecretCredential(
      process.env.TENANT_ID,
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );
    
    // Crear el cliente de Microsoft Graph con el proveedor de credenciales de cliente
    const authProvider = {
      getAccessToken: async () => {
        const token = await credential.getToken(['https://graph.microsoft.com/.default']);
        return token.token;
      }
    };

    const graphClient = Client.initWithMiddleware({
      authProvider
    });

    // Formatear destinatarios
    const recipients = {
      toRecipients: (Array.isArray(to) ? to : [to]).map(email => ({ emailAddress: { address: email } })),
      ccRecipients: cc.map(email => ({ emailAddress: { address: email } })),
      bccRecipients: bcc.map(email => ({ emailAddress: { address: email } }))
    };

    // Crear mensaje
    const message = {
      subject: `[LaSalle Neza] ${subject}`,
      body: {
        contentType: 'HTML',
        content: content
      },
      ...recipients
    };

    // Enviar mensaje usando el correo del remitente configurado en el .env.local
    await graphClient
      .api(`/users/${process.env.EMAIL_USER}/sendMail`)
      .post({
        message: message,
        saveToSentItems: true
      });

    console.log('Correo enviado correctamente vía Microsoft Graph');
    
    return {
      success: true,
      id: `graph-${Date.now()}`
    };
  } catch (error) {
    console.error('Error al enviar correo vía Microsoft Graph:', error);
    throw error;
  }
}
