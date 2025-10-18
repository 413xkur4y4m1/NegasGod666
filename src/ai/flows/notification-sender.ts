import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendNotificationEmail } from '@/lib/send-notification';
import { ref, get, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendClientNotification } from '@/lib/client-notifications';

const NotificationSenderInputSchema = z.object({
  userQuery: z.string().describe('La instrucción de a quién y qué notificación enviar'),
  context: z.object({
    loans: z.string().optional().describe("JSON string de todos los préstamos"),
    users: z.string().optional().describe("JSON string de todos los usuarios"),
    materials: z.string().optional().describe("JSON string de todos los materiales")
  }).optional()
});

const NotificationSenderOutputSchema = z.object({
  response: z.string().describe('Confirmación del envío o mensaje de error'),
  notification: z.object({
    to: z.string().describe('Correo del destinatario'),
    subject: z.string().describe('Asunto del correo'),
    content: z.string().describe('Contenido HTML del correo'),
    recipientName: z.string().describe('Nombre del destinatario'),
    userId: z.string().describe('El ID del usuario destinatario')
  })
});

export type NotificationSenderInput = z.infer<typeof NotificationSenderInputSchema>;
export type NotificationSenderOutput = z.infer<typeof NotificationSenderOutputSchema>;

// Función principal exportada que será llamada por la acción del chat
export async function sendNotification(input: NotificationSenderInput): Promise<NotificationSenderOutput> {
  try {
    // Simplemente ejecutamos el flujo y devolvemos su resultado.
    // Toda la lógica de envío ahora vive dentro del flujo.
    const result = await notificationSenderFlow(input);
    return result;
  } catch (error) {
    console.error('Error en el proceso de enviar notificación:', error);
    throw new Error(`No se pudo completar el envío: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

const notificationPrompt = ai.definePrompt({
  name: 'notificationSenderPrompt',
  input: {schema: NotificationSenderInputSchema},
  output: {schema: NotificationSenderOutputSchema},
  prompt: `Asistente para enviar notificaciones personalizadas.
  
  Analiza la instrucción del usuario y los datos del sistema para:
  1. Identificar el destinatario (usuario) y el propósito de la notificación.
  2. Generar un correo profesional en formato HTML.
  
  DATOS DEL SISTEMA:
  - Préstamos, usuarios y materiales disponibles en formato JSON.
  
  INSTRUCCIONES DE SALIDA:
  Genera una respuesta JSON con la siguiente estructura:
  - "response": Un mensaje de confirmación para el administrador (ej: "Notificación enviada a Juan Pérez.").
  - "notification": Un objeto con:
    - "to": El correo electrónico del destinatario.
    - "subject": Un asunto claro y conciso.
    - "content": El mensaje en formato HTML.
    - "recipientName": El nombre completo del destinatario.
    - "userId": El ID del usuario destinatario (ej: "L53T9fl1fCgLDODDNZJyj1AJYNn2"). Es MUY IMPORTANTE que extraigas este ID de los datos de usuarios.`
});

const notificationSenderFlow = ai.defineFlow(
  {
    name: 'notificationSenderFlow',
    inputSchema: NotificationSenderInputSchema,
    outputSchema: NotificationSenderOutputSchema,
  },
  async (input: NotificationSenderInput) => {
    const { userQuery } = input;
    let contextData = { loans: {}, users: {}, materials: {} };

    try {
      // Obtener datos actualizados de Firebase para dar contexto a la IA
      const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
        get(ref(db, 'prestamos')),
        get(ref(db, 'usuarios')),
        get(ref(db, 'materiales'))
      ]);
      contextData = {
        loans: loansSnapshot.val() || {},
        users: usersSnapshot.val() || {},
        materials: materialsSnapshot.val() || {}
      };
    } catch (error) {
      console.error('Error al obtener datos de Firebase:', error);
      // Continuamos incluso si falla, la IA podría funcionar solo con la query del usuario
    }
    
    // Ejecutar la IA para que genere el contenido de la notificación
    const { output } = await notificationPrompt({
        userQuery, 
        context: {
            users: JSON.stringify(contextData.users),
            loans: JSON.stringify(contextData.loans),
            materials: JSON.stringify(contextData.materials)
        }
    });

    if (!output?.notification?.userId) {
        console.error("La IA no generó una notificación válida con userId.", output);
        throw new Error("La IA no pudo identificar al destinatario de la notificación.");
    }
    
    const { notification } = output;

    // --- ORQUESTACIÓN DEL ENVÍO ---

    // 1. Enviar notificación por correo (Outlook)
    await sendNotificationEmail(notification);

    // 2. Enviar notificación a la interfaz del estudiante
    await sendClientNotification(notification);

    // 3. Guardar la notificación en la base de datos para el historial
    const notificationsRef = ref(db, 'notificaciones');
    await push(notificationsRef, {
        userId: notification.userId,
        type: 'manual_admin', // Tipo para identificar que fue enviada por un admin
        message: notification.content,
        subject: notification.subject,
        timestamp: serverTimestamp(),
        read: false,
    });

    // Devolver la respuesta generada por la IA
    return output;
  }
);