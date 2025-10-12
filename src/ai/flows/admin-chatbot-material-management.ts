// admin-chatbot-material-management.ts
'use server';

/**
 * @fileOverview AI agent for assisting administrators in managing and adding new materials to the inventory.
 *
 * - `manageMaterial`: A function that processes the admin's request to add or manage materials.
 * - `ManageMaterialInput`: The input type for the manageMaterial function.
 * - `ManageMaterialOutput`: The return type for the manageMaterial function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, set, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendOutlookNotification } from '@/lib/notifications';
import { notificationTemplates } from '@/lib/notificationTemplates';
import { logger } from '@/lib/logger';

interface Material {
  nombre: string;
  cantidad: number;
  estado: string;
  precio_unitario: number;
  imageUrl?: string;
}

const ManageMaterialInputSchema = z.object({
  userQuery: z
    .string()
    .describe(
      'The admin query, can be a request to add material or a question about the data.'
    ),
  context: z.object({
      loans: z.string().optional().describe("JSON string of all loans."),
      users: z.string().optional().describe("JSON string of all users."),
      materials: z.string().optional().describe("JSON string of all materials."),
  }).optional()
});

export type ManageMaterialInput = z.infer<typeof ManageMaterialInputSchema>;

const MaterialAction = z.object({
  type: z.enum(['add', 'update', 'remove', 'check']),
  material: z.object({
    name: z.string(),
    quantity: z.number().optional(),
    condition: z.string().optional(),
    precio_unitario: z.number().optional(),
  }),
  notifications: z.array(z.object({
    type: z.enum(['material_added', 'material_updated', 'material_low']),
    recipients: z.array(z.string())
  })).optional()
});

const ManageMaterialOutputSchema = z.object({
  response: z
    .string()
    .describe(
      'A confirmation message or the answer to the admin query.'
    ),
  isDataQuery: z.boolean().describe("Whether the query was a question about data."),
  action: MaterialAction.optional().describe("The action to perform on the material inventory"),
});

export type ManageMaterialOutput = z.infer<typeof ManageMaterialOutputSchema>;

export async function manageMaterial(input: ManageMaterialInput): Promise<ManageMaterialOutput> {
  const result = await manageMaterialFlow(input);
  
  // Si hay una acción que realizar en los materiales
  if (result.action && !result.isDataQuery) {
    try {
      const materialsRef = ref(db, 'materiales');
      const materialsSnapshot = await get(materialsRef);
      const currentMaterials = materialsSnapshot.val() || {};
      
      switch (result.action.type) {
        case 'add': {
          const materialId = `material_${Date.now()}`;
          await set(ref(db, `materiales/${materialId}`), {
            nombre: result.action.material.name,
            cantidad: result.action.material.quantity || 0,
            estado: result.action.material.condition || 'Nuevo',
            precio_unitario: result.action.material.precio_unitario || 0,
          });

          // Enviar notificación de material agregado
          if (result.action.notifications) {
            for (const notification of result.action.notifications) {
              if (notification.type === 'material_added') {
                for (const recipient of notification.recipients) {
                  const template = notificationTemplates.materialAdded(
                    result.action.material.name,
                    result.action.material.quantity || 0
                  );
                  await sendOutlookNotification({
                    to: recipient,
                    ...template
                  });
                }
              }
            }
          }
          break;
        }
        case 'update': {
          const materialToUpdate = Object.entries(currentMaterials as Record<string, Material>).find(
            ([_, mat]) => mat.nombre === result.action?.material.name
          );

          if (materialToUpdate) {
            const [materialId, currentMaterial] = materialToUpdate;
            const updates: Material = {
              ...currentMaterial,
              cantidad: result.action?.material.quantity || currentMaterial.cantidad,
              estado: result.action?.material.condition || currentMaterial.estado,
              precio_unitario: result.action?.material.precio_unitario || currentMaterial.precio_unitario,
            };

            await update(ref(db, `materiales/${materialId}`), updates);

            // Verificar si el stock está bajo después de la actualización
            if (updates.cantidad < 5) { // umbral de stock bajo
              if (result.action.notifications) {
                for (const notification of result.action.notifications) {
                  if (notification.type === 'material_low') {
                    for (const recipient of notification.recipients) {
                      const template = notificationTemplates.materialLow(
                        result.action.material.name,
                        updates.cantidad
                      );
                      await sendOutlookNotification({
                        to: recipient,
                        ...template
                      });
                    }
                  }
                }
              }
            }
          }
          break;
        }
      }
    } catch (error) {
      logger.error('admin', 'material-management-error', error);
      throw new Error('No se pudo procesar la acción en el inventario');
    }
  }

  return result;
}

const prompt = ai.definePrompt({
  name: 'manageMaterialPrompt',
  input: {schema: ManageMaterialInputSchema},
  output: {schema: ManageMaterialOutputSchema},
  prompt: `You are an AI assistant helping an administrator manage a university's material loan system.

You have access to various actions and can trigger notifications when necessary.

Your tasks are to:
1. **Answer questions** about the current state of loans, users, and materials based on the provided JSON data context.
2. **Process material management actions** and trigger appropriate notifications.

For questions (e.g., "who has active loans?", "show me users with debts"):
- Analyze the provided JSON data context
- Provide a clear, concise answer
- Set 'isDataQuery' to true
- Do not include any action object

For material management actions:
- Set 'isDataQuery' to false
- Include an 'action' object with the following structure:
  * type: 'add' for new materials, 'update' for existing ones
  * material: details including name, quantity, condition, precio_unitario
  * notifications: array of notification objects, each with:
    - type: 'material_added' for new materials
    - type: 'material_updated' for updates
    - type: 'material_low' when quantity is low (< 5)
    - recipients: array of email addresses to notify

Examples of actions:
1. Adding new material:
   Query: "agregar 10 cuchillos de chef a $50 cada uno"
   Action: {
     type: "add",
     material: {
       name: "Cuchillo de Chef",
       quantity: 10,
       precio_unitario: 50,
       condition: "Nuevo"
     },
     notifications: [{
       type: "material_added",
       recipients: ["admin@universidad.edu"]
     }]
   }

2. Updating material:
   Query: "actualizar la cantidad de martillos a 3 unidades"
   Action: {
     type: "update",
     material: {
       name: "Martillo",
       quantity: 3
     },
     notifications: [{
       type: "material_low",
       recipients: ["admin@universidad.edu"]
     }]
   }

Admin query: {{{userQuery}}}

Data Context (if available):
- Loans: {{{context.loans}}}
- Users: {{{context.users}}}
- Materials: {{{context.materials}}}
`,
});

const manageMaterialFlow = ai.defineFlow(
  {
    name: 'manageMaterialFlow',
    inputSchema: ManageMaterialInputSchema,
    outputSchema: ManageMaterialOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
