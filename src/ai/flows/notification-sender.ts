'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendNotificationEmail } from '@/lib/send-notification';
import { ref, get, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendClientNotification } from '@/lib/client-notifications';
import { logger } from '@/lib/logger';

const NotificationSenderInputSchema = z.object({
  userQuery: z.string().describe('La instrucción sobre a quién y qué notificar. Ej: "Envíale un recordatorio a Ana por el cuchillo que debe", "Notifica a todos con adeudos"'),
  context: z.object({
    loans: z.string().optional().describe("JSON string de todos los préstamos activos y vencidos"),
    users: z.string().optional().describe("JSON string de todos los usuarios (alumnos y administradores)"),
    materials: z.string().optional().describe("JSON string de todo el inventario de utensilios y equipo de cocina")
  }).optional()
});

const NotificationSenderOutputSchema = z.object({
    response: z.string().describe('Confirmación del envío o mensaje de error para el administrador.'),
    notification: z.object({
      to: z.string().describe('Correo electrónico del alumno destinatario.'),
      subject: z.string().describe('Asunto del correo, ej: "Recordatorio de Préstamo Vencido".'),
      content: z.string().describe('Contenido del correo en formato HTML, amigable y profesional.'),
      recipientName: z.string().describe('Nombre completo del alumno destinatario.'),
      userId: z.string().describe('El ID único del usuario destinatario. Es crucial extraerlo correctamente.')
    }).optional() // Hacer opcional para poder devolver solo el `response` en caso de error.
  });

const notificationPrompt = ai.definePrompt({
  name: 'notificationSenderPrompt',
  input: {schema: NotificationSenderInputSchema},
  output: {schema: NotificationSenderOutputSchema},
  prompt: `Eres un asistente inteligente en un laboratorio de gastronomía. Tu tarea es ayudar al administrador a enviar notificaciones a los alumnos sobre sus préstamos de utensilios y equipo de cocina.

  Analiza la instrucción del administrador y los datos del sistema para:
  1. Identificar al destinatario (alumno/s) y el propósito de la notificación (ej: recordatorio de devolución, aviso de préstamo vencido).
  2. Generar un correo electrónico profesional y amigable en formato HTML.

  DATOS DEL SISTEMA QUE TIENES DISPONIBLES:
  - Préstamos: Contiene información sobre qué alumno tiene qué material y las fechas de devolución.
  - Usuarios: Contiene los datos de los alumnos, incluyendo nombre, matrícula y correo.
  - Materiales: El inventario completo de utensilios y equipo de cocina.

  INSTRUCCIONES DE SALIDA:
  Genera una respuesta JSON con la siguiente estructura:
  - "response": Un mensaje de confirmación para el administrador (ej: "Notificación de recordatorio enviada a Juan Pérez.").
  - "notification": Un objeto con los detalles para el envío:
    - "to": El correo electrónico del alumno.
    - "subject": Un asunto claro y conciso (ej: "Recordatorio de Préstamo en el Laboratorio de Gastronomía").
    - "content": El mensaje en formato HTML. Sé cordial y claro.
    - "recipientName": El nombre completo del alumno.
    - "userId": El ID único del alumno. Es MUY IMPORTANTE que extraigas este ID de los datos de usuarios del contexto.`
});


const notificationSenderFlow = ai.defineFlow(
  {
    name: 'notificationSenderFlow',
    inputSchema: NotificationSenderInputSchema,
    outputSchema: NotificationSenderOutputSchema,
  },
  async (input: z.infer<typeof NotificationSenderInputSchema>) => {
    const { userQuery } = input;
    let contextData = { loans: {}, users: {}, materials: {} };

    try {
      const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
        get(ref(db, 'prestamos')),
        get(ref(db, 'alumnos')),
        get(ref(db, 'materiales'))
      ]);
      contextData = {
        loans: loansSnapshot.val() || {},
        users: usersSnapshot.val() || {},
        materials: materialsSnapshot.val() || {}
      };
    } catch (error) {
      logger.error('admin', 'firebase-data-fetch-error', { error: error instanceof Error ? error.message : String(error) });
      // No lanzar error, pero sí registrarlo. La IA podría funcionar sin contexto.
    }
    
    const { output } = await notificationPrompt({
        userQuery, 
        context: {
            users: JSON.stringify(contextData.users),
            loans: JSON.stringify(contextData.loans),
            materials: JSON.stringify(contextData.materials)
        }
    });

    if (!output?.notification?.userId) {
        logger.error('admin', 'ia-no-user-id', { output });
        // Devolver una respuesta estructurada en lugar de lanzar un error
        return { response: "La IA no pudo identificar al destinatario. Por favor, sé más específico en tu solicitud." };
    }
    
    const { notification } = output;

    // --- ORQUESTACIÓN DEL ENVÍO ---
    await sendNotificationEmail(notification);
    await sendClientNotification(notification); // Esta es la llamada que puede fallar

    const notificationsRef = ref(db, 'notificaciones');
    await push(notificationsRef, {
        userId: notification.userId,
        type: 'manual_admin',
        message: notification.content,
        subject: notification.subject,
        timestamp: serverTimestamp(),
        read: false,
    });

    return output;
  }
);

export async function sendNotification(input: z.infer<typeof NotificationSenderInputSchema>): Promise<z.infer<typeof NotificationSenderOutputSchema>> {
  try {
    const result = await notificationSenderFlow(input);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('admin', 'notification-flow-critical-error', { 
        error: errorMessage,
        userQuery: input.userQuery
    });
    
    // Devolver una respuesta JSON válida en lugar de lanzar una excepción.
    // Esto previene que la aplicación cliente se rompa.
    return {
        response: `Ocurrió un error crítico durante el envío. Por favor, revisa los logs del servidor. Detalles: ${errorMessage}`
    };
  }
}
