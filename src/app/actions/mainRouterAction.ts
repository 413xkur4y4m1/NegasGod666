
'use server';

import { mainRouterFlow } from '@/ai/flows/main-router';

interface MainRouterPayload {
  input: string;
}

/**
 * Esta acción de servidor actúa como el único punto de entrada 
 * desde el chat del admin hacia el backend de IA.
 */
export async function mainRouterAction({ input }: MainRouterPayload): Promise<{ success: boolean; message: string; details?: any; }> {
  console.log(`[mainRouterAction] Procesando a través del router principal: "${input}"`);
  
  try {
    // Llama al flujo router de Genkit para que orqueste la respuesta.
    const result = await mainRouterFlow({ userQuery: input });
    return result;

  } catch (error) {
    console.error('[mainRouterAction] Error al invocar el flujo del router principal:', error);
    return {
      success: false,
      message: `Ocurrió un error inesperado al procesar tu solicitud. ${error instanceof Error ? error.message : ''}`,
    };
  }
}
