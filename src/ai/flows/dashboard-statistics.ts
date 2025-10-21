
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { LoanSchema, DebtSchema } from '@/lib/types'; // Import the new schemas

// --- INPUT & OUTPUT SCHEMAS (Unchanged) ---
const StatsDataSchema = z.object({
  totalMaterials: z.number(),
  totalLoans: z.number(),
  activeLoans: z.number(),
  overdueLoans: z.number(),
  totalUsers: z.number(),
  usersWithDebt: z.number(),
  loanFrequency: z.record(z.string(), z.number()),
});

const ChartDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(z.object({
    label: z.string(),
    data: z.array(z.number()),
  })),
});

const AnalysisOutputSchema = z.object({
  analysisText: z.string().describe('Análisis en LENGUAJE ESPAÑOL sobre el estado del inventario.'),
  loanStatusChart: ChartDataSchema.describe('Datos para una gráfica de pastel sobre el estado de los préstamos.'),
  mostLoanedChart: ChartDataSchema.describe('Datos para una gráfica de barras de los 5 materiales más prestados.'),
});

// --- AI PROMPT (Unchanged) ---
const statisticsAnalyzerPrompt = ai.definePrompt({
  name: 'statisticsAnalyzerPrompt',
  input: { schema: StatsDataSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `
    Eres un analista de datos experto para el sistema de inventario de un laboratorio de gastronomía. 
    TU TAREA ES TRADUCIR LAS MÉTRICAS A UN ANÁLISIS EN ESPAÑOL Y ESTRUCTURAR LOS DATOS PARA GRÁFICAS.

    MÉTRICAS CRUDAS:
    - Materiales Totales: {totalMaterials}
    - Préstamos Históricos: {totalLoans}
    - Préstamos Activos: {activeLoans}
    - Préstamos Vencidos: {overdueLoans}
    - Usuarios Totales: {totalUsers}
    - Usuarios con Adeudos: {usersWithDebt}
    - Frecuencia de Préstamos: ${'JSON.stringify(loanFrequency)'}

    INSTRUCCIONES:
    1.  **Genera el \`analysisText\` (en ESPAÑOL):** 
        - Proporciona un resumen claro y conciso del estado del inventario.
        - Destaca puntos clave como el número de usuarios con adeudos y el porcentaje de préstamos vencidos.

    2.  **Genera los datos para \`loanStatusChart\` (Gráfica de Pastel):
        - \`labels\`: ['Préstamos al Corriente', 'Préstamos Vencidos']
        - \`datasets[0].label\`: 'Estado de Préstamos'
        - \`datasets[0].data\`: [El número de préstamos activos MENOS los vencidos, el número de préstamos vencidos]

    3.  **Genera los datos para \`mostLoanedChart\` (Gráfica de Barras):
        - Analiza \`loanFrequency\` y devuelve los 5 más altos.
        - \`labels\`: Array con los nombres de los 5 materiales más prestados.
        - \`datasets[0].label\`: 'Préstamos por Material'
        - \`datasets[0].data\`: Array con el conteo de préstamos para cada uno de esos 5 materiales.
  `,
});

// --- REFACTORED MAIN FLOW ---

export const dashboardStatisticsFlow = ai.defineFlow(
  {
    name: 'dashboardStatisticsFlow',
    inputSchema: z.null(),
    outputSchema: z.object({
      stats: StatsDataSchema,
      analysis: AnalysisOutputSchema,
    }),
  },
  async () => {
    try {
      const [loansSnapshot, materialsSnapshot, usersSnapshot, debtsSnapshot] = await Promise.all([
        get(ref(db, 'prestamos')),
        get(ref(db, 'materiales')),
        get(ref(db, 'alumno')),
        get(ref(db, 'adeudos')),
      ]);

      const rawLoans = loansSnapshot.val() || {};
      const rawMaterials = materialsSnapshot.val() || {};
      const rawUsers = usersSnapshot.val() || {};
      const rawDebts = debtsSnapshot.val() || {};

      // --- PARSE AND TRANSFORM DATA USING ZOD SCHEMAS ---
      const parsedLoans = Object.values(rawLoans)
        .map(loan => LoanSchema.safeParse(loan))
        .filter(p => p.success)
        .map(p => (p as { success: true; data: z.infer<typeof LoanSchema> }).data);

      const parsedDebts = Object.values(rawDebts)
        .map(debt => DebtSchema.safeParse(debt))
        .filter(p => p.success)
        .map(p => (p as { success: true; data: z.infer<typeof DebtSchema> }).data);


      // --- CALCULATE STATISTICS ON CLEAN DATA ---
      const activeLoans = parsedLoans.filter(loan => 
        loan.status === 'activo' || loan.status === 'pendiente'
      );

      const overdueLoans = activeLoans.filter(loan => 
        new Date(loan.fechaLimite) < new Date()
      ).length;

      const usersWithDebt = new Set(parsedDebts
        .filter(debt => debt.status === 'pendiente')
        .map(debt => debt.matriculaAlumno)
      ).size;

      const loanFrequency: { [key: string]: number } = {};
      parsedLoans.forEach(loan => {
        loanFrequency[loan.nombreMaterial] = (loanFrequency[loan.nombreMaterial] || 0) + 1;
      });

      const stats: z.infer<typeof StatsDataSchema> = {
        totalMaterials: Object.keys(rawMaterials).length,
        totalLoans: parsedLoans.length,
        activeLoans: activeLoans.length,
        overdueLoans,
        totalUsers: Object.keys(rawUsers).length,
        usersWithDebt,
        loanFrequency,
      };

      // --- GENERATE AI ANALYSIS ---
      const { output: analysis } = await statisticsAnalyzerPrompt(stats);

      if (!analysis) {
        logger.error('admin', 'stats-analysis-failed', { stats });
        throw new Error('La IA no pudo generar el análisis de estadísticas.');
      }

      return {
        stats,
        analysis,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('admin', 'dashboard-flow-error', { error: errorMessage });
      throw new Error(`No se pudieron calcular las estadísticas: ${errorMessage}`);
    }
  }
);
