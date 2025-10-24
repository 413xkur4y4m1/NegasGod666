'use server';

import { z } from 'zod';
import { ref, get, update, push } from 'firebase/database';
import { db } from '../../lib/firebase';
import { logger } from '../../lib/logger';
import { Loan, Debt, User, LoanSchema, DebtSchema, UserSchema } from '../../lib/types';
import { sendBulkHtmlNotifications, NotificationPayload } from '../../lib/bulk-notification-mailer';

// --- CONSTANTS ---
const LOAN_REMINDER_DAYS_BEFORE_DUE = 2;
const LOAN_TO_DEBT_DAYS_AFTER_DUE = 7;
const DEBT_REMINDER_INTERVAL_DAYS = 4;

// --- HELPER: DATE CALCULATIONS ---
const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 1000 * 60 * 60 * 24;
  const diff = Math.round((date2.getTime() - date1.getTime()) / oneDay);
  return diff;
};

/**
 * The main function for the automated loan supervisor. 
 * This is designed to be run on a schedule (e.g., once a day).
 */
export async function runAutomatedLoanSupervisor() {
  logger.action('system', 'loan-supervisor-started', {});
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  try {
    const [loansSnap, debtsSnap, usersSnap] = await Promise.all([
      get(ref(db, 'prestamos')),
      get(ref(db, 'adeudos')),
      get(ref(db, 'alumnos')),
    ]);

    const rawLoans = loansSnap.val() || {};
    const rawDebts = debtsSnap.val() || {};
    const rawUsers = usersSnap.val() || {};

    const allUsers: User[] = Object.values(rawUsers).map(u => UserSchema.safeParse(u)).filter(p => p.success).map(p => (p as { success: true; data: User }).data);
    
    const notificationsToSend: NotificationPayload[] = [];
    const updates: Record<string, any> = {};

    // Process Active Loans
    for (const loanId in rawLoans) {
      const parsedLoan = LoanSchema.safeParse(rawLoans[loanId]);
      if (!parsedLoan.success) continue;
      const loan = parsedLoan.data;

      if (loan.status !== 'activo') continue;

      const dueDate = new Date(loan.fechaLimite);
      const daysDiff = daysBetween(today, dueDate);
      const student = allUsers.find(u => u.matricula === loan.matriculaAlumno);

      if (!student) continue;

      if (daysDiff > 0 && daysDiff <= LOAN_REMINDER_DAYS_BEFORE_DUE) {
        notificationsToSend.push({ type: 'loanReminder', recipient: student, loanDetails: loan });
      } else if (daysDiff < 0) {
        updates[`/prestamos/${loanId}/estado`] = 'vencido';
        notificationsToSend.push({ type: 'loanOverdue', recipient: student, loanDetails: loan });
        logger.action('system', 'loan-marked-overdue', { loanId });
      }
    }

    // Process Overdue Loans and convert to Debts
    for (const loanId in rawLoans) {
        const parsedLoan = LoanSchema.safeParse(rawLoans[loanId]);
        if (!parsedLoan.success) continue;
        const loan = parsedLoan.data;

        if (loan.status !== 'vencido') continue;

        const dueDate = new Date(loan.fechaLimite);
        const daysOverdue = Math.abs(daysBetween(today, dueDate));
        const student = allUsers.find(u => u.matricula === loan.matriculaAlumno);

        if (!student || !loan.precioUnitario) continue;

        if (daysOverdue >= LOAN_TO_DEBT_DAYS_AFTER_DUE) {
            updates[`/prestamos/${loanId}/estado`] = 'perdido';
            const newDebtId = push(ref(db, 'adeudos')).key;
            if(newDebtId) {
                // We need to create the raw object that firebase expects
                const newRawDebt = {
                    id: newDebtId,
                    matricula_alumno: loan.matriculaAlumno,
                    nombre_alumno: loan.nombreAlumno,
                    monto: loan.precioUnitario,
                    estado: 'pendiente',
                    fecha_adeudo: today.toISOString(),
                    fecha_actualizacion: today.toISOString(),
                    id_material: loan.idMaterial,
                    nombre_material: loan.nombreMaterial,
                    descripcion: `Adeudo generado por no devolución del material: ${loan.nombreMaterial}.`,
                };
                updates[`/adeudos/${newDebtId}`] = newRawDebt;
                // But we use the clean, parsed object for notifications
                const newDebt = DebtSchema.parse(newRawDebt);
                notificationsToSend.push({ type: 'newDebt', recipient: student, debtDetails: newDebt });
                logger.action('system', 'loan-converted-to-debt', { loanId, newDebtId });
            }
        }
    }

    // Process Pending Debts for reminders
    for (const debtId in rawDebts) {
        const parsedDebt = DebtSchema.safeParse(rawDebts[debtId]);
        if (!parsedDebt.success) continue;
        const debt = parsedDebt.data;
        
        const debtDate = new Date(debt.fechaAdeudo);
        const daysSinceCreation = daysBetween(debtDate, today);
        const student = allUsers.find(u => u.matricula === debt.matriculaAlumno);

        if (!student) continue;

        if (debt.status === 'pendiente' && daysSinceCreation > 0 && daysSinceCreation % DEBT_REMINDER_INTERVAL_DAYS === 0) {
            notificationsToSend.push({ type: 'debtReminder', recipient: student, debtDetails: debt });
        }
    }
    
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
      logger.action('system', 'database-updated', { updates });
    }

    if (notificationsToSend.length > 0) {
      await sendBulkHtmlNotifications(notificationsToSend);
      logger.action('system', 'notifications-sent', { count: notificationsToSend.length });
    }

    logger.action('system', 'loan-supervisor-finished', {});
    return { success: true, message: `Supervisor run successfully. Found ${notificationsToSend.length} notifications to send.` };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('system', 'loan-supervisor-failed', error);
    return { success: false, message: `Supervisor failed: ${errorMessage}` };
  }
}
