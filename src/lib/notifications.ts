import nodemailer from 'nodemailer';

// Función para obtener el transportador de Nodemailer con las credenciales de Outlook
// Lo hacemos como función para asegurar que las variables de entorno estén disponibles en tiempo de ejecución
function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('[Outlook] Credenciales de correo no configuradas correctamente');
    throw new Error('Las credenciales de correo no están configuradas correctamente');
  }

  console.log(`[Outlook] Configurando transportador para ${process.env.EMAIL_USER}`);
  
  return nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    },
    debug: true, // Habilitar debugging
    logger: true // Habilitar logging
  });
}

export async function sendOutlookNotification({
  to,
  subject,
  content
}: {
  to: string;
  subject: string;
  content: string;
}) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Las credenciales de correo no están configuradas correctamente');
  }

  try {
    console.log(`[Outlook] Preparando envío a ${to}`);
    console.log(`[Outlook] Remitente: ${process.env.EMAIL_USER}`);
    
    // Obtener transportador en el momento de envío
    const transporter = getTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `[LaSalle Neza] ${subject}`,
      html: content,
      text: content.replace(/<[^>]*>/g, ''), // Remove HTML tags for plain text
    };

    console.log('[Outlook] Enviando correo...');
    const info = await transporter.sendMail(mailOptions);
    console.log('[Outlook] Mensaje enviado: %s', info.messageId);

    return {
      success: true,
      id: info.messageId || 'sent' // Usamos el ID del mensaje o 'sent' como fallback
    };
  } catch (error) {
    console.error('[Outlook] Error al enviar notificación:', error);
    throw new Error(`Error al enviar la notificación: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}