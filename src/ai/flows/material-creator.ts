
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, push, set } from 'firebase/database';
import { db } from '@/lib/firebase';

// 1. Definimos el esquema de entrada: el lenguaje natural del admin
const MaterialCreatorInputSchema = z.object({
  userQuery: z.string().describe('La instrucción en lenguaje natural del administrador para agregar un nuevo material. Ej: "Agrega 15 martillos de la marca Stanley para carpintería"'),
});

// 2. Definimos el esquema de salida: los datos estructurados que la IA debe extraer
const MaterialCreatorOutputSchema = z.object({
  quantity: z.number().int().positive().describe('La cantidad de unidades del material a agregar.'),
  name: z.string().describe('El nombre descriptivo del material. Ej: "Martillo de carpintero"'),
  brand: z.string().optional().describe('La marca del material, si se especifica.'),
  category: z.string().optional().describe('La categoría a la que pertenece el material, si se especifica.'),
});

// 3. Creamos el Prompt de Genkit para la extracción de información
const materialExtractorPrompt = ai.definePrompt({
  name: 'materialExtractorPrompt',
  input: { schema: MaterialCreatorInputSchema },
  output: { schema: MaterialCreatorOutputSchema },
  prompt: `Eres un asistente inteligente encargado de registrar nuevos materiales en el inventario de un sistema de préstamos.

    Tu tarea es analizar la solicitud del usuario y extraer de manera precisa los siguientes datos del texto:
    - La cantidad de material.
    - El nombre o descripción del material.
    - La marca (si la mencionan).
    - La categoría (si la mencionan).

    Analiza la siguiente solicitud y extrae la información en el formato solicitado.

    Solicitud del usuario: 
    ${'userQuery'}
  `,
});

// 4. Definimos el flujo principal que orquesta el proceso
export const createMaterialFlow = ai.defineFlow(
  {
    name: 'createMaterialFlow',
    inputSchema: MaterialCreatorInputSchema,
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      materialId: z.string().optional(),
    }),
  },
  async (input) => {
    console.log(`[createMaterialFlow] Iniciando flujo con la consulta: "${input.userQuery}"`);

    // Paso 1: Usar la IA para extraer los datos estructurados de la consulta
    const { output: extractedMaterial } = await materialExtractorPrompt(input);

    if (!extractedMaterial) {
      console.error('[createMaterialFlow] La IA no pudo extraer la información del material.');
      return {
        success: false,
        message: 'No pude entender los detalles del material en tu solicitud. ¿Podrías intentarlo de nuevo de forma más clara?',
      };
    }

    console.log('[createMaterialFlow] Datos extraídos por la IA:', extractedMaterial);

    const { name, quantity, brand, category } = extractedMaterial;

    // Paso 2: Escribir los datos en Firebase Realtime Database
    try {
      const newMaterialRef = push(ref(db, 'materiales'));
      const newMaterialId = newMaterialRef.key;

      await set(newMaterialRef, {
        id: newMaterialId,
        nombre: name,
        cantidad: quantity,
        disponibles: quantity, // Por defecto, todos los nuevos están disponibles
        marca: brand || 'Genérica', // Asignar un valor por defecto si no se extrae
        categoria: category || 'General', // Asignar un valor por defecto si no se extrae
        fecha_adquisicion: new Date().toISOString(),
        estado: 'Activo',
      });

      console.log(`[createMaterialFlow] Material creado con éxito con ID: ${newMaterialId}`);

      return {
        success: true,
        message: `¡Hecho! He agregado ${quantity} unidad(es) de "${name}" al inventario.`,
        materialId: newMaterialId,
      };
    } catch (error) {
      console.error('[createMaterialFlow] Error al guardar el material en Firebase:', error);
      return {
        success: false,
        message: `Hubo un error al intentar guardar el nuevo material en la base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`, 
      };
    }
  }
);
