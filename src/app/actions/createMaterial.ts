
'use server';

import { createMaterialFlow } from '@/ai/flows/material-creator';

interface CreateMaterialPayload {
  input: string;
}

/**
 * Esta acción de servidor actúa como un puente entre el componente del chat
 * y el flujo de Genkit para crear materiales.
 */
export async function createMaterialAction({ input }: CreateMaterialPayload): Promise<{ success: boolean; message: string; }> {
  console.log(`[createMaterialAction] Recibida solicitud para crear material: "${input}"`);
  
  try {
    // Llama al flujo de Genkit para que procese la solicitud del usuario
    const result = await createMaterialFlow({
      userQuery: input,
    });

    return {
      success: result.success,
      message: result.message,
    };

  } catch (error) {
    console.error('[createMaterialAction] Error al invocar el flujo de creación de material:', error);
    return {
      success: false,
      message: `Ocurrió un error inesperado al procesar tu solicitud. ${error instanceof Error ? error.message : ''}`,
    };
  }
}
