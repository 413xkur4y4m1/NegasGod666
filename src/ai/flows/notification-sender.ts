import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { sendNotificationEmail } from '@/lib/send-notification';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';

// Importamos la versión compatible para entornos cliente/navegador
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
    recipientName: z.string().describe('Nombre del destinatario')
  })
});

export type NotificationSenderInput = z.infer<typeof NotificationSenderInputSchema>;
export type NotificationSenderOutput = z.infer<typeof NotificationSenderOutputSchema>;

export async function sendNotification(input: NotificationSenderInput): Promise<NotificationSenderOutput> {
  const result = await notificationSenderFlow(input);
  
  try {
    // Determinamos si estamos en el cliente o servidor
    const isClient = typeof window !== 'undefined';
    
    if (isClient) {
      // En el cliente, usamos la versión compatible con el navegador
      await sendClientNotification(result.notification);
    } else {
      // En el servidor, usamos la versión de servidor
      await sendNotificationEmail(result.notification);
    }
    return result;
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    throw new Error(`No se pudo enviar la notificación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

const notificationPrompt = ai.definePrompt({
  name: 'notificationSenderPrompt',
  input: {schema: NotificationSenderInputSchema},
  output: {schema: NotificationSenderOutputSchema},
  prompt: `Asistente para enviar notificaciones personalizadas.
  
  Analiza la instrucción del usuario y:
  1. Identifica el destinatario y el tipo de notificación
  2. Genera un correo apropiado y profesional
  3. Maneja varios tipos de notificaciones como:
     - Adeudos de materiales
     - Recordatorios de devolución
     - Avisos de préstamos vencidos
     - Materiales dañados
     - Notificaciones generales
  
  Si el contexto incluye datos de préstamos, usuarios o materiales, úsalos para personalizar el mensaje.`
});

const notificationSenderFlow = ai.defineFlow(
  {
    name: 'notificationSenderFlow',
    inputSchema: NotificationSenderInputSchema,
    outputSchema: NotificationSenderOutputSchema,
  },
  async (input: NotificationSenderInput) => {
    const { userQuery, context } = input;
    let contextData = {
      loans: {},
      users: {},
      materials: {}
    };

    try {
      // Obtener datos actualizados de Firebase
      const dbRefs = {
        loans: ref(db, 'prestamos'),
        users: ref(db, 'usuarios'),
        materials: ref(db, 'materiales')
      };

      const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
        get(dbRefs.loans),
        get(dbRefs.users),
        get(dbRefs.materials)
      ]);

      contextData = {
        loans: loansSnapshot.val() || {},
        users: usersSnapshot.val() || {},
        materials: materialsSnapshot.val() || {}
      };
    } catch (error) {
      console.error('Error al obtener datos de Firebase:', error);
    }

    const prompt = `
    Eres un asistente encargado de enviar notificaciones en el sistema de préstamos de LaSalle.
    
    INSTRUCCIÓN DEL USUARIO:
    ${userQuery}

    DATOS DEL SISTEMA:
    ${JSON.stringify(contextData, null, 2)}

    Analiza la instrucción y genera una notificación profesional y efectiva.
    
    Recuerda:
    1. Usar un tono profesional y amable
    2. Incluir detalles específicos de los datos disponibles
    3. Personalizar el mensaje según el contexto
    4. Usar el formato HTML para mejor presentación
    5. Mantener el asunto conciso y claro
    
    Genera una respuesta con:
    1. El correo del destinatario (buscándolo en los datos de usuarios)
    2. Un asunto apropiado
    3. Un mensaje en HTML bien formateado
    4. El nombre completo del destinatario
    `;
    
    const {output} = await notificationPrompt({userQuery, context});
    return output!;
  }
);

// Ejemplo de uso:
// sendNotification({
//   userQuery: "Envía una notificación de adeudo al estudiante con matrícula ABC123 sobre el material audiovisual",
//   context: { /* datos opcionales */ }
// });