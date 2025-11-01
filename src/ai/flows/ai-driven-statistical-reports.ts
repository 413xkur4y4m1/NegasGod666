'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- Esquema para los Datos de las Gráficas ---
const ChartDataSchema = z.object({
  materialesMasPrestados: z
    .array(z.object({ name: z.string(), count: z.number() }))
    .describe('Datos para una gráfica de barras de los 5 materiales más prestados.'),
  distribucionEstadoPrestamos: z
    .array(z.object({ name: z.string(), value: z.number() }))
    .describe('Datos para un gráfico de pastel de la distribución de estados de préstamos (e.g., activo, vencido).'),
  actividadPorUsuario: z
    .array(z.object({ name: z.string(), count: z.number() }))
    .describe('Datos para una tabla o gráfica de los 5 usuarios con más préstamos.'),
});

// --- Esquemas de Entrada y Salida ---
const StatisticalReportInputSchema = z.object({
  materialData: z.string().describe('Cadena JSON con los datos de materiales.'),
  loanData: z.string().describe('Cadena JSON con los datos de préstamos.'),
  userData: z.string().describe('Cadena JSON con los datos de usuarios.'),
});
export type StatisticalReportInput = z.infer<typeof StatisticalReportInputSchema>;

const StatisticalReportOutputSchema = z.object({
  report: z.string().describe('El reporte narrativo generado en español.'),
  chartData: ChartDataSchema.optional().describe('Datos estructurados para generar gráficas.'),
});
export type StatisticalReportOutput = z.infer<typeof StatisticalReportOutputSchema>;

// --- Prompt de la IA ---
const statisticalReportPrompt = ai.definePrompt({
  name: 'statisticalReportPrompt',
  input: { schema: StatisticalReportInputSchema },
  output: { schema: StatisticalReportOutputSchema },
  model: 'googleai/gemini-2.5-pro', // ✅ especifica el modelo explícitamente
  prompt: `
Eres un asistente de IA experto en análisis de datos para un laboratorio universitario. 
Tu tarea es procesar datos y devolver un análisis completo en español.

Recibirás datos sobre materiales, préstamos y usuarios en formato JSON.

Datos de Materiales: {{{materialData}}}
Datos de Préstamos: {{{loanData}}}
Datos de Usuarios: {{{userData}}}

Basándote en los datos, realiza dos tareas y devuelve el resultado como un único objeto JSON:

1. **Genera un Informe Narrativo (clave: "report")**: 
   Escribe un informe en español, en texto plano y sin viñetas, que resuma:
   - Los materiales más utilizados y cualquier patrón de desgaste o daño inferido.
   - El estado general de los préstamos (proporción de activos vs. vencidos).
   - Patrones de comportamiento de los usuarios (usuarios más activos, etc.).
   - Recomendaciones accionables para la gestión del inventario y préstamos.

2. **Extrae Datos para Gráficas (clave: "chartData")**:
   Analiza los datos numéricos y crea un objeto JSON con la siguiente estructura:
   - materialesMasPrestados: [{ name, count }]
   - distribucionEstadoPrestamos: [{ name, value }]
   - actividadPorUsuario: [{ name, count }]

Asegúrate de que la respuesta final sea solo el objeto JSON con las claves "report" y "chartData".
`,
});

// --- Definición del Flujo ---
const statisticalReportFlow = ai.defineFlow(
  {
    name: 'statisticalReportFlow',
    inputSchema: StatisticalReportInputSchema,
    outputSchema: StatisticalReportOutputSchema,
  },
  async (input) => {
    const response = await statisticalReportPrompt(input);

    // ✅ Validación segura contra nulos o respuestas incompletas
    if (!response?.output) {
      throw new Error('No se pudo generar el reporte. La respuesta del modelo fue nula o inválida.');
    }

    return response.output;
  }
);

// --- Función principal ---
export async function generateStatisticalReport(
  input: StatisticalReportInput
): Promise<StatisticalReportOutput> {
  return statisticalReportFlow(input);
}
