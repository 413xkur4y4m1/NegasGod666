'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, set, get, update, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { notificationSenderFlow } from './notification-sender';

// --- Esquemas ---
const ManageMaterialInputSchema = z.object({
  userQuery: z.string().describe('La consulta del administrador.'),
});

export type ManageMaterialInput = z.infer<typeof ManageMaterialInputSchema>;

const ActionSchema = z.object({
  type: z.enum(['add', 'update', 'remove', 'check', 'send_notification', 'data_query']),
  material: z.object({
    name: z.string(),
    quantity: z.number().optional(),
    precioUnitario: z.number().optional(),
  }).optional(),
});

const ManageMaterialOutputSchema = z.object({
  response: z.string(),
  action: ActionSchema.optional(),
});

export type ManageMaterialOutput = z.infer<typeof ManageMaterialOutputSchema>;


// --- Orquestador Principal ---
export async function manageMaterial(input: ManageMaterialInput): Promise<ManageMaterialOutput> {
  const classificationResult = await manageMaterialFlow(input);

  if (classificationResult.action) {
    try {
      switch (classificationResult.action.type) {
        case 'add':
          if (!classificationResult.action.material?.name) {
            return { response: 'No pude identificar el nombre del material para añadir.' };
          }
          const newMaterial = classificationResult.action.material;
          const newMaterialRef = push(ref(db, 'materiales'));
          await set(newMaterialRef, {
            id: newMaterialRef.key,
            name: newMaterial.name,
            quantity: newMaterial.quantity || 0,
            precioUnitario: newMaterial.precioUnitario || 0,
          });
          logger.action('admin', 'material-add', { name: newMaterial.name });
          return { response: `✅ ¡Hecho! Añadí ${newMaterial.quantity || ''} ${newMaterial.name} al inventario.` };

        case 'update':
          if (!classificationResult.action.material?.name) {
            return { response: 'No pude identificar qué material actualizar.' };
          }
          const materialToUpdate = classificationResult.action.material;
          const materialsRef = ref(db, 'materiales');
          const snapshot = await get(materialsRef);
          if (!snapshot.exists()) {
            return { response: 'No hay materiales en la base de datos para actualizar.' };
          }

          const materials = snapshot.val();
          const materialId = Object.keys(materials).find(key => materials[key].name.toLowerCase() === materialToUpdate.name.toLowerCase());

          if (!materialId) {
            return { response: `No encontré ningún material llamado "${materialToUpdate.name}". ¿Quieres añadirlo?` };
          }

          const updates: any = {};
          if (materialToUpdate.quantity !== undefined) updates.quantity = materialToUpdate.quantity;
          if (materialToUpdate.precioUnitario !== undefined) updates.precioUnitario = materialToUpdate.precioUnitario;

          await update(ref(db, `materiales/${materialId}`), updates);
          logger.action('admin', 'material-update', { name: materialToUpdate.name, updates });
          return { response: `✅ ¡Listo! Actualicé la información de ${materialToUpdate.name}.` };

        case 'send_notification':
          logger.action('admin', 'delegando-a-notification-sender', { query: input.userQuery });
          // CORREGIDO: Llama al flujo correcto con el input adecuado
          return await notificationSenderFlow({ userQuery: input.userQuery });

        case 'data_query':
        case 'check':
          logger.action('admin', 'data-query', { query: input.userQuery });
          return classificationResult;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logger.error('admin', 'error-gestion-material', new Error(errorMessage), { rawError: error });
      return { response: `Tuve un problema al procesar esa acción: ${errorMessage}` };
    }
  }

  return classificationResult;
}

// --- Prompt y Flujo de IA (El "Cerebro") ---
const prompt = ai.definePrompt({
  name: 'manageMaterialPrompt',
  input: { schema: ManageMaterialInputSchema },
  output: { schema: ManageMaterialOutputSchema },
  prompt: `Eres un asistente de IA para un administrador de un sistema universitario. Tu trabajo es analizar su consulta y clasificarla en una acción ejecutable.

Acciones disponibles:

1.  **send_notification**: Si la consulta es para enviar notificaciones a un individuo o a un GRUPO de usuarios (todos, con adeudos, con préstamos).
    -   Ejemplos: "manda recordatorio a todos los que tienen adeudos", "notifica a los que tienen préstamos", "avísale a todos los alumnos", "mándale un recordatorio a Juan Pérez".
    -   Tu respuesta debe ser un acuse de recibo como "Entendido, iniciando envío masivo...".

2.  **add**: Para AÑADIR o REGISTRAR nuevo material.
    -   Ejemplo: "agregar 15 sartenes de teflón a 250 cada uno".

3.  **update**: Para ACTUALIZAR la cantidad o precio de un material existente.
    -   Ejemplo: "ahora hay 20 sartenes de teflón, actualiza el inventario".

4.  **data_query**: Si es una PREGUNTA o BÚSQUEDA de información.
    -   Ejemplo: "¿cuántos sartenes hay?", "¿quién tiene préstamos vencidos?".

Consulta del administrador: "{{{userQuery}}}"

Responde en formato JSON.
`,
});

const manageMaterialFlow = ai.defineFlow(
  {
    name: 'manageMaterialFlow',
    inputSchema: ManageMaterialInputSchema,
    outputSchema: ManageMaterialOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
