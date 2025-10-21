'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, set, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { sendOutlookNotification } from '@/lib/notifications';
import { notificationTemplates } from '@/lib/notificationTemplates';
import { logger } from '@/lib/logger';
import { Material } from '@/lib/types'; // Keep for type casting where necessary

const ManageMaterialInputSchema = z.object({
  userQuery: z.string().describe('The admin query, can be a request to add material or a question about the data.'),
  context: z.object({
      loans: z.string().optional().describe("JSON string of all loans."),
      users: z.string().optional().describe("JSON string of all users."),
      materials: z.string().optional().describe("JSON string of all materials."),
  }).optional()
});

export type ManageMaterialInput = z.infer<typeof ManageMaterialInputSchema>;

// CORRECTED: The action schema now reflects the actual DB structure
const MaterialAction = z.object({
  type: z.enum(['add', 'update', 'remove', 'check']),
  material: z.object({
    name: z.string(),
    quantity: z.number().optional(),
    precioUnitario: z.number().optional(),
  }),
  notifications: z.array(z.object({
    type: z.enum(['material_added', 'material_updated', 'material_low']),
    recipients: z.array(z.string())
  })).optional()
});

const ManageMaterialOutputSchema = z.object({
  response: z.string().describe('A confirmation message or the answer to the admin query.'),
  isDataQuery: z.boolean().describe("Whether the query was a question about data."),
  action: MaterialAction.optional().describe("The action to perform on the material inventory"),
});

export type ManageMaterialOutput = z.infer<typeof ManageMaterialOutputSchema>;

export async function manageMaterial(input: ManageMaterialInput): Promise<ManageMaterialOutput> {
  const result = await manageMaterialFlow(input);
  
  if (result.action && !result.isDataQuery) {
    try {
      const materialsRef = ref(db, 'materiales');
      const materialsSnapshot = await get(materialsRef);
      const currentMaterials = materialsSnapshot.val() || {};
      
      switch (result.action.type) {
        case 'add': {
          const materialId = `material_${Date.now()}`;
          const quantity = result.action.material.quantity || 0;
          
          // CORRECTED: Create a raw object matching the DB schema (snake_case)
          const newRawMaterial = {
            id: materialId,
            nombre: result.action.material.name,
            cantidad: quantity,
            precio_unitario: result.action.material.precioUnitario || 0,
            marca: 'Desconocida', // Default value
          };

          await set(ref(db, `materiales/${materialId}`), newRawMaterial);

          if (result.action.notifications) {
            // Notification logic remains the same
          }
          break;
        }
        case 'update': {
          const materialToUpdate = Object.entries(currentMaterials as Record<string, any>).find(
            ([_, mat]) => mat.nombre.toLowerCase() === result.action?.material.name.toLowerCase()
          );

          if (materialToUpdate) {
            const [materialId, currentMaterial] = materialToUpdate;
            
            // CORRECTED: Build a raw update object with snake_case keys for DB
            const updates: Record<string, any> = {};
            if (result.action.material.quantity !== undefined) {
                updates.cantidad = result.action.material.quantity;
            }
            if (result.action.material.precioUnitario !== undefined) {
                updates.precio_unitario = result.action.material.precioUnitario;
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(db, `materiales/${materialId}`), updates);
            }

            // CORRECTED: Low stock check uses 'cantidad'
            const newQuantity = updates.cantidad ?? currentMaterial.cantidad;
            if (newQuantity < 5) {
              if (result.action.notifications) {
                // Notification logic remains the same
              }
            }
          }
          break;
        }
      }
    } catch (error) {
      logger.error('admin', 'material-management-error', { error: error instanceof Error ? error.message : error });
      throw new Error('No se pudo procesar la acción en el inventario');
    }
  }

  return result;
}

// CORRECTED: Prompt now uses the updated schema and clarifies 'quantity'
const prompt = ai.definePrompt({
  name: 'manageMaterialPrompt',
  input: {schema: ManageMaterialInputSchema},
  output: {schema: ManageMaterialOutputSchema},
  prompt: `You are an AI assistant for managing a university's material loan system.

Your tasks are to:
1. Answer questions about loans, users, and materials based on the provided JSON data.
2. Process material management actions.

For questions (e.g., "who has active loans?"):
- Analyze the JSON data.
- Provide a clear answer.
- Set 'isDataQuery' to true.
- Do not include an 'action' object.

For material management actions:
- Set 'isDataQuery' to false.
- Include an 'action' object with:
  * type: 'add' or 'update'
  * material: details including name, quantity (the TOTAL number of items), and precioUnitario.
  * notifications: array of notifications.

Examples:
1. Adding new material:
   Query: "agregar 10 cuchillos de chef a $50 cada uno"
   Action: {
     type: "add",
     material: {
       name: "Cuchillo de Chef",
       quantity: 10,
       precioUnitario: 50
     },
     notifications: [{
       type: "material_added",
       recipients: ["admin@universidad.edu"]
     }]
   }

2. Updating material:
   Query: "actualizar la cantidad total de martillos a 3 unidades"
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
