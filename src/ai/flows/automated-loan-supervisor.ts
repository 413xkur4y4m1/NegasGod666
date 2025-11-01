
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get, update } from 'firebase/database';
import { Loan, User, LoanSchema, UserSchema } from '@/lib/types';
import { logger } from '@/lib/logger';

// --- ZOD SCHEMAS ---
const SupervisorInputSchema = z.object({
  user: UserSchema,
  loan: LoanSchema,
  diffDays: z.number(),
});

const SupervisorOutputSchema = z.object({
  decision: z.enum(['approve', 'escalate', 'remind', 'ignore']),
  reasoning: z.string(),
  updates: z.record(z.any()).optional(),
});

// --- AI PROMPT ---
const loanSupervisorPrompt = ai.definePrompt({
  name: 'loanSupervisorPrompt',
  input: { schema: SupervisorInputSchema },
  output: { schema: SupervisorOutputSchema },
  prompt: `
    Eres un supervisor de préstamos en el sistema de inventario de una universidad.
    Analiza la información del préstamo y del usuario para decidir la acción a tomar.

    Contexto:
    - Usuario: {{json user}}
    - Préstamo: {{json loan}}
    - Días desde el préstamo: {{diffDays}}

    Reglas de Decisión:
    - Si el préstamo está \'vencido\' y han pasado más de 3 días, \'escalate\'.
    - Si el préstamo está \'vencido\' pero han pasado 3 días o menos, \'remind\'.
    - Si el estado es \'activo\' y han pasado más de 7 días, \'remind\'.
    - Si el usuario tiene un historial de préstamos problemáticos (ej. multiples \'perdido\'), \'escalate\'.
    - De lo contrario, \'approve\' o \'ignore\' si no se requiere acción.

    Responde en formato JSON con tu decisión y razonamiento.
  `,
});

// --- MAIN FLOW ---
export const automatedLoanSupervisor = ai.defineFlow(
  { name: 'automatedLoanSupervisor' },
  async () => {
    const loansRef = ref(db, 'prestamos');
    const usersRef = ref(db, 'alumnos');
    const [loansSnap, usersSnap] = await Promise.all([get(loansRef), get(usersRef)]);
    const allLoans = loansSnap.val() || {};
    const allUsers = usersSnap.val() || {};

    for (const loanId in allLoans) {
      const rawLoan = { ...allLoans[loanId], id_prestamo: loanId };
      const loanResult = LoanSchema.safeParse(rawLoan);

      if (!loanResult.success) {
        logger.error('system', 'loan-schema-validation-failed', loanResult.error, { loanId });
        continue;
      }
      const loan = loanResult.data;

      const rawUser = Object.values(allUsers).find((u: any) => u.matricula === loan.matriculaAlumno);
      const userResult = UserSchema.safeParse(rawUser);

      if (!userResult.success) {
        logger.error('system', 'user-schema-validation-failed', userResult.error, { matricula: loan.matriculaAlumno });
        continue;
      }
      const user = userResult.data;

      const diffDays = Math.floor((new Date().getTime() - new Date(loan.fechaPrestamo).getTime()) / (1000 * 3600 * 24));

      const { output } = await loanSupervisorPrompt({ user, loan, diffDays });

      if (output?.decision === 'remind' || output?.decision === 'escalate') {
        const updates: { [key: string]: any } = {};
        updates[`/prestamos/${loan.idPrestamo}/estado`] = 'vencido';
        await update(ref(db), updates);

        logger.action('system', 'loan-status-updated', { loanId: loan.idPrestamo, newStatus: 'vencido' });
      }
    }
  }
);
