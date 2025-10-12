import nodemailer from 'nodemailer';

// Configurar el transporter de Nodemailer con las credenciales de Outlook
const transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

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
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: `[LaSalle Neza] ${subject}`,
      html: content,
      text: content.replace(/<[^>]*>/g, ''), // Remove HTML tags for plain text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Mensaje enviado: %s', info.messageId);

    return {
      success: true,
      id: info.messageId || 'sent' // Usamos el ID del mensaje o 'sent' como fallback
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new Error(`Error al enviar la notificación: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}