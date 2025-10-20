
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ref, push, set } from 'firebase/database';
import { db } from '@/lib/firebase';

// 1. Esquema de entrada con ejemplo contextualizado para gastronomía
const MaterialCreatorInputSchema = z.object({
  userQuery: z.string().describe('La instrucción en lenguaje natural del administrador para agregar un nuevo utensilio o equipo. Ej: "Agrega 15 sartenes de teflón marca T-fal para la cocina 2"'),
});

// 2. Esquema de salida (sin cambios en la estructura)
const MaterialCreatorOutputSchema = z.object({
  quantity: z.number().int().min(1).describe('La cantidad de unidades del ítem a agregar.'),
  name: z.string().describe('El nombre descriptivo del ítem. Ej: "Sartén de teflón", "Cuchillo de chef"'),
  brand: z.string().optional().describe('La marca del ítem, si se especifica.'),
  category: z.string().optional().describe('La categoría a la que pertenece el ítem (ej: "utensilios", "cuchillería", "equipo eléctrico"), si se especifica.'),
});

// 3. Prompt mejorado con contexto de gastronomía
const materialExtractorPrompt = ai.definePrompt({
  name: 'materialExtractorPrompt',
  input: { schema: MaterialCreatorInputSchema },
  output: { schema: MaterialCreatorOutputSchema },
  prompt: `Eres un asistente de inventario para un laboratorio de gastronomía. Tu rol es analizar las solicitudes del administrador para añadir nuevo equipamiento, utensilios o insumos al sistema.

    Tu tarea es analizar la solicitud del usuario y extraer de manera precisa los siguientes datos del texto:
    - La cantidad de unidades del ítem.
    - El nombre o descripción del ítem (ej: "Sartén de teflón", "Cuchillo de chef").
    - La marca (si la mencionan).
    - La categoría (ej: "utensilios", "cuchillería", "equipo eléctrico"), si se especifica.

    Analiza la siguiente solicitud y extrae la información en el formato solicitado.

    Solicitud del usuario: 
    ${'userQuery'}
  `,
});

// 4. Flujo principal (sin cambios en la lógica)
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

    try {
      const newMaterialRef = push(ref(db, 'materiales'));
      const newMaterialId = newMaterialRef.key;

      await set(newMaterialRef, {
        id: newMaterialId,
        nombre: name,
        cantidad: quantity,
        disponibles: quantity,
        marca: brand || 'Genérica',
        categoria: category || 'General',
        fechaAdquisicion: new Date().toISOString(),
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
