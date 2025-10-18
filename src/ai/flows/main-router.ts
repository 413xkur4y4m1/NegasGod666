
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

// Importamos las ACCIONES que ya hemos creado, que a su vez llaman a los flujos de IA.
// Esto nos permite reutilizar la lógica de servidor existente.
import { createMaterialAction } from '@/app/actions/createMaterial';
import { processAdminChatNotification, notifyAllStudentsWithDebts } from '@/app/actions/chatNotifications';
import { manageMaterial } from '@/ai/flows/admin-chatbot-material-management';

// 1. Definimos las posibles intenciones que el router puede identificar.
const IntentSchema = z.object({
  intent: z.enum(['notification', 'create_material', 'query', 'notify_all_with_debts'])
    .describe('La intención principal de la solicitud del usuario.'),
});

// 2. Creamos un prompt de Genkit específicamente para detectar la intención.
const intentDetector = ai.definePrompt({
    name: 'intentDetector',
    input: { schema: z.object({ userQuery: z.string() }) },
    output: { schema: IntentSchema },
    prompt: `Eres un experto en clasificar la intención de un usuario en un sistema de gestión de inventario. Analiza la solicitud y clasifícala en una de las siguientes categorías:

- 'notification': El usuario quiere enviar un mensaje, correo, notificación o alerta a uno o más estudiantes específicos.
- 'notify_all_with_debts': El usuario quiere enviar una notificación masiva a TODOS los estudiantes que tengan adeudos.
- 'create_material': El usuario quiere añadir, crear o registrar un nuevo ítem, artículo o material en el inventario.
- 'query': El usuario está haciendo una pregunta, solicitando información, o queriendo ver datos del sistema.

Solicitud del Usuario:
"{$userQuery}"`,
});

// 3. Definimos el flujo principal del router.
export const mainRouterFlow = ai.defineFlow(
  {
    name: 'mainRouterFlow',
    inputSchema: z.object({ userQuery: z.string() }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        details: z.any().optional(),
    }),
  },
  async ({ userQuery }) => {
    // Paso 1: Detectar la intención
    const { output } = await intentDetector({ userQuery });
    if (!output) {
        return { success: false, message: 'Lo siento, no pude determinar la intención de tu solicitud.' };
    }
    const intent = output.intent;
    console.log(`[mainRouterFlow] Intención detectada por la IA: ${intent}`);

    // Paso 2: Llamar a la acción o flujo correspondiente
    switch (intent) {
      case 'notification':
        return await processAdminChatNotification({ input: userQuery });

      case 'notify_all_with_debts':
        return await notifyAllStudentsWithDebts();

      case 'create_material':
        return await createMaterialAction({ input: userQuery });

      case 'query':
        // El flujo de consulta necesita el contexto de la base de datos
        const [loansSnapshot, usersSnapshot, materialsSnapshot] = await Promise.all([
            get(ref(db, 'prestamos')),
            get(ref(db, 'alumno')),
            get(ref(db, 'materiales')),
        ]);
        const context = {
            loans: JSON.stringify(loansSnapshot.val() || {}),
            users: JSON.stringify(usersSnapshot.val() || {}),
            materials: JSON.stringify(materialsSnapshot.val() || {}),
        };
        const result = await manageMaterial({ userQuery, context });
        return { success: true, message: result.response };

      default:
        return { success: false, message: 'Intención reconocida, pero no hay una acción configurada.' };
    }
  }
);
