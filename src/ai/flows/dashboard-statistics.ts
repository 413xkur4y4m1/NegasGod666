
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { get, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

// Esquema para los datos que se pasarán al prompt de IA
const StatsDataSchema = z.object({
  totalMaterials: z.number(),
  totalLoans: z.number(),
  activeLoans: z.number(),
  overdueLoans: z.number(),
  availableMaterials: z.number(),
  usersWithDebt: z.number(),
  mostLoanedMaterial: z.string().optional(),
});

// Esquema para la salida del prompt (el análisis de la IA)
const AnalysisOutputSchema = z.object({
  analysis: z.string().describe('Un análisis en lenguaje natural sobre el estado actual de la biblioteca.'),
});

// El Prompt de IA que actuará como analista de datos
const statisticsAnalyzerPrompt = ai.definePrompt({
  name: 'statisticsAnalyzerPrompt',
  input: { schema: StatsDataSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `
    Eres un analista de datos experto para el sistema de biblioteca de LaSalle.
    Tu tarea es analizar las siguientes métricas y generar un resumen conciso y útil para el administrador.
    Destaca los puntos más importantes, como el número de adeudos, la disponibilidad de material y cualquier tendencia que observes.

    Métricas:
    - Materiales Totales: {totalMaterials}
    - Préstamos Históricos: {totalLoans}
    - Préstamos Activos Ahora: {activeLoans}
    - Préstamos Vencidos: {overdueLoans}
    - Materiales Disponibles: {availableMaterials}
    - Estudiantes con Adeudos: {usersWithDebt}
    - Material Más Prestado: {mostLoanedMaterial || 'N/A'}

    Basado en estos datos, genera el campo "analysis" con tu resumen.
  `,
});

// El flujo principal que orquesta todo
export const dashboardStatisticsFlow = ai.defineFlow(
  {
    name: 'dashboardStatisticsFlow',
    inputSchema: z.null(), // No necesita input
    outputSchema: z.object({
        stats: StatsDataSchema,
        analysis: AnalysisOutputSchema,
    }),
  },
  async () => {
    // 1. Obtener todos los datos de Firebase
    const [loansSnapshot, materialsSnapshot, usersSnapshot, debtsSnapshot] = await Promise.all([
      get(ref(db, 'prestamos')),
      get(ref(db, 'materiales')),
      get(ref(db, 'usuarios')),
      get(ref(db, 'adeudos')),
    ]);

    const loans = loansSnapshot.val() || {};
    const materials = materialsSnapshot.val() || {};
    const users = usersSnapshot.val() || {};
    const debts = debtsSnapshot.val() || {};

    // 2. Calcular las estadísticas
    const totalMaterials = Object.keys(materials).length;
    const totalLoans = Object.keys(loans).length;
    
    const activeLoansList = Object.values(loans).filter((loan: any) => loan.status === 'prestado');
    const activeLoans = activeLoansList.length;
    const overdueLoans = activeLoansList.filter((loan: any) => new Date(loan.dueDate) < new Date()).length;

    const availableMaterials = totalMaterials - activeLoans;
    const usersWithDebt = Object.keys(debts).length;

    // Calcular el material más prestado
    const loanCounts: { [key: string]: number } = {};
    Object.values(loans).forEach((loan: any) => {
        loanCounts[loan.materialName] = (loanCounts[loan.materialName] || 0) + 1;
    });
    const mostLoanedMaterial = Object.keys(loanCounts).reduce((a, b) => loanCounts[a] > loanCounts[b] ? a : b, '');

    const stats: z.infer<typeof StatsDataSchema> = {
        totalMaterials,
        totalLoans,
        activeLoans,
        overdueLoans,
        availableMaterials,
        usersWithDebt,
        mostLoanedMaterial,
    };

    // 3. Generar el análisis con la IA
    const { output: analysis } = await statisticsAnalyzerPrompt(stats);

    if (!analysis) {
        throw new Error('La IA no pudo generar el análisis de estadísticas.');
    }

    // 4. Devolver ambos, los datos crudos y el análisis
    return {
        stats,
        analysis,
    };
  }
);
