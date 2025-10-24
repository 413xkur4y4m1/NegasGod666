'use server';

import { ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const UpdateLoanStatusSchema = z.object({
  loanId: z.string(),
  newStatus: z.enum(['activo', 'devuelto', 'perdido', 'pendiente', 'vencido']),
});

/**
 * Allows an admin to manually update the status of a loan.
 * @param params - The loan ID and the new status.
 */
export async function updateLoanStatus(params: z.infer<typeof UpdateLoanStatusSchema>) {
  try {
    const validatedParams = UpdateLoanStatusSchema.parse(params);
    const { loanId, newStatus } = validatedParams;

    const updates: Record<string, any> = {};
    updates[`/prestamos/${loanId}/estado`] = newStatus;

    await update(ref(db), updates);

    // TODO: Trigger a single, targeted notification to the user about the status change.

    logger.action('admin', 'manual-loan-status-update', { loanId, newStatus });

    return { success: true, message: `Loan ${loanId} status updated to ${newStatus}.` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('admin', 'manual-loan-status-update-failed', error);
    return { success: false, message: `Failed to update loan status: ${errorMessage}` };
  }
}
