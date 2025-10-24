'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, set, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { sendNotification } from './notification-sender';

const ManageMaterialInputSchema = z.object({
  userQuery: z.string().describe('La consulta del administrador sobre materiales o notificaciones.'),
  context: z.object({
      loans: z.string().optional().describe("JSON string de todos los préstamos."),
      users: z.string().optional().describe("JSON string de todos los usuarios."),
      materials: z.string().optional().describe("JSON string de todos los materiales."),
  }).optional()
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
  response: z.string().describe('Un mensaje de confirmación, la respuesta a una pregunta, o un acuse de recibo.'),
  action: ActionSchema.optional().describe("La acción a realizar."),
});

export type ManageMaterialOutput = z.infer<typeof ManageMaterialOutputSchema>;

export async function manageMaterial(input: ManageMaterialInput): Promise<ManageMaterialOutput> {
  const result = await manageMaterialFlow(input);

  if (result.action) {
    try {
        switch (result.action.type) {
            case 'add':
            case 'update':
                logger.action('admin', `material-${result.action.type}`, { name: result.action.material?.name });
                // Lógica de base de datos para añadir/actualizar iría aquí
                break;

            case 'send_notification':
                logger.action('admin', 'delegando-a-notification-sender', { query: input.userQuery });
                const notificationResult = await sendNotification({ userQuery: input.userQuery });
                return { response: notificationResult.response };

            case 'data_query':
            case 'check':
                logger.action('admin', 'data-query', { query: input.userQuery });
                break;
      }
    } catch (error) {
      logger.error('admin', 'error-gestion-material', { error: error instanceof Error ? error.message : error });
      return { response: 'Tuve un problema al procesar esa acción. Por favor, intenta de nuevo.' };
    }
  }

  return result;
}

// CORREGIDO: Prompt ahora se enfoca en "ejecutar acciones" en lugar de solo "clasificar".
const prompt = ai.definePrompt({
  name: 'manageMaterialPrompt',
  input: {schema: ManageMaterialInputSchema},
  output: {schema: ManageMaterialOutputSchema},
  prompt: `Eres un asistente de IA que ejecuta tareas para el administrador de un sistema de préstamos universitario. Tu trabajo es analizar su consulta y ejecutar la acción correspondiente, devolviendo un objeto JSON que el sistema pueda procesar.

Estas son las acciones que puedes ejecutar:

1.  **send_notification**: Si la consulta es para ENVIAR, MANDAR o generar un RECORDATORIO a alguien.
    -   Ejemplo de consulta: "mándale un recordatorio a (Nombre del Alumno)"
    -   **Acción a ejecutar**: El sistema usará tu clasificación para invocar la función de envío de notificaciones. Tu respuesta en el campo 'response' del JSON debe ser un simple acuse de recibo como "Entendido, procesando notificación..."

2.  **add**: Si la consulta es para AÑADIR, CREAR o REGISTRAR nuevo material.
    -   Ejemplo de consulta: "agregar 15 (nombre de material) a (precio) cada uno"
    -   **Acción a ejecutar**: El sistema usará los datos que extraigas para añadir el material a la base de datos. Debes poblar el objeto 'material' en tu respuesta JSON.

3.  **update**: Si la consulta es para ACTUALIZAR la cantidad o precio de un material.
    -   Ejemplo de consulta: "ahora hay (cantidad) de (nombre de material), actualiza el inventario"
    -   **Acción a ejecutar**: El sistema usará los datos que extraigas para actualizar la base de datos. Debes poblar el objeto 'material' en tu respuesta JSON.

4.  **data_query**: Si la consulta es una PREGUNTA o BÚSQUEDA de información.
    -   Ejemplo de consulta: "¿quién tiene préstamos vencidos?"
    -   **Acción a ejecutar**: Responde la pregunta directamente en el campo 'response' y clasifica la acción como 'data_query'. El sistema simplemente mostrará tu respuesta.

Consulta del administrador: {{{userQuery}}}

Contexto de datos (para tu referencia al responder preguntas):
- Préstamos: {{{context.loans}}}
- Usuarios: {{{context.users}}}
- Materiales: {{{context.materials}}}
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
