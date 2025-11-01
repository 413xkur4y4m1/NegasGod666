'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logger';
import { bulkNotificationFlow } from './bulk-notification-flow';

// --- Tipos y Esquemas ---
const NotificationSenderInputSchema = z.object({
  userQuery: z.string().describe('La consulta original del administrador, ej: "envía un recordatorio a todos los que tienen préstamos vencidos"'),
});

const DispatcherChoiceSchema = z.object({
  choice: z.enum([
    'all_loans', 
    'all_debts', 
    'all_users', 
    'unknown'
  ]).describe('La categoría de notificación masiva a la que se debe enviar la consulta del usuario.'),
});

// --- Prompt del Despachador ---
const dispatcherPrompt = ai.definePrompt({
  name: 'notificationDispatcherPrompt',
  input: { schema: z.object({ userQuery: z.string() }) },
  output: { schema: DispatcherChoiceSchema },
  prompt: `
    Eres un despachador inteligente para un sistema de notificaciones masivas. Tu trabajo es analizar la solicitud de un administrador y clasificarla en una de las siguientes categorías para que otro flujo la maneje:

    - 'all_loans': Para consultas sobre recordatorios de préstamos.
    - 'all_debts': Para consultas sobre recordatorios de adeudos.
    - 'all_users': Para consultas generales o anuncios a todos los usuarios.
    - 'unknown': Si la solicitud no encaja en ninguna de las anteriores.

    Analiza la siguiente consulta y decide a qué categoría pertenece.
    
    Consulta: "{{{userQuery}}}"
  `,
});


// --- Flujo Principal del Despachador ---
export const notificationSenderFlow = ai.defineFlow(
  {
    name: 'notificationSenderFlow',
    inputSchema: NotificationSenderInputSchema,
    outputSchema: z.object({ response: z.string() }),
  },
  async ({ userQuery }) => {
    logger.action('system', 'notification-sender-start', { userQuery });

    // 1. Usar IA para clasificar la solicitud
    const { output } = await dispatcherPrompt({ userQuery });

    if (!output) {
      logger.error('system', 'dispatcher-ia-fail', { userQuery });
      return { response: 'Lo siento, no pude entender a quién enviar la notificación. Por favor, sé más específico.' };
    }

    // 2. CORRECCIÓN: En todos los casos, la tarea se delega al 'bulkNotificationFlow',
    // que está diseñado para interpretar la consulta del usuario y actuar en consecuencia.
    // Este flujo ya no necesita decidir la lógica, solo despachar al flujo correcto.

    logger.action('system', 'dispatching-to-bulk-flow', { userQuery, decision: output.choice });

    // Si la IA no está segura, proporcionamos una respuesta directa.
    if (output.choice === 'unknown') {
        return { response: 'No estoy seguro de a quién enviar esta notificación. Por favor, especifica si es para usuarios con préstamos, con adeudos o para todos.' };
    }

    // Se delega la tarea al flujo de notificaciones masivas, pasando la consulta original.
    const result = await bulkNotificationFlow({ userQuery });
    
    return result; // El resultado de bulkNotificationFlow ya tiene el formato { response: string }
  }
);
