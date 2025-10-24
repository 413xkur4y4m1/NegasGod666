'use server';

import { z } from 'zod';
import { ref, push, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { LoanSchema, UserSchema, MaterialSchema } from '@/lib/types';

// --- ZOD SCHEMA FOR INPUT VALIDATION ---
const CreateLoanSchema = z.object({
  materialId: z.string().min(1, 'El ID del material es obligatorio.'),
  materialName: z.string().min(1, 'El nombre del material es obligatorio.'),
  studentMatricula: z.string().min(1, 'La matrícula del alumno es obligatoria.'),
  studentName: z.string().min(1, 'El nombre del alumno es obligatorio.'),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de devolución debe tener el formato YYYY-MM-DD.'),
  // Optional fields that might be useful
  materia: z.string().optional(),
  precioUnitario: z.number().optional(),
});

// --- SERVER ACTION ---
export const createLoanAction = async (input: z.infer<typeof CreateLoanSchema>) => {
  try {
    // 1. Validate input with Zod
    const validationResult = CreateLoanSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(e => e.message).join(', ');
      logger.error('student', 'create-loan-validation-failed', { error: errorMessages, input });
      return { success: false, message: `Datos de entrada inválidos: ${errorMessages}` };
    }

    const { 
      materialId, 
      materialName, 
      studentMatricula, 
      studentName, 
      returnDate, 
      materia, 
      precioUnitario 
    } = validationResult.data;

    // 2. Create a new reference in the 'prestamos' branch
    const loansRef = ref(db, 'prestamos');
    const newLoanRef = push(loansRef); // push() generates a unique ID
    const newLoanId = newLoanRef.key;

    if (!newLoanId) {
      throw new Error('Failed to generate a new loan ID with Firebase.');
    }

    // 3. Define the loan data structure
    const loanData = {
      id_prestamo: newLoanId,
      id_material: materialId,
      nombre_material: materialName,
      matricula_alumno: studentMatricula,
      nombre_alumno: studentName,
      fecha_prestamo: new Date().toISOString().split('T')[0], // Today in YYYY-MM-DD format
      fecha_limite: returnDate,
      estado: 'pendiente', // As requested, all new loans start as pending
      materia: materia ?? 'N/A',
      precio_unitario: precioUnitario ?? 0,
    };

    // 4. Set the data in the database
    await set(newLoanRef, loanData);

    logger.action('student', 'loan-request-created', { loanId: newLoanId, matricula: studentMatricula });

    // 5. Revalidate path if necessary (for Server Components)
    revalidatePath('/dashboard/prestamos'); // Invalidate cache for loan list pages

    return { 
      success: true, 
      message: `¡Solicitud de préstamo para "${materialName}" creada exitosamente! Tu solicitud está pendiente de aprobación.`,
      loanId: newLoanId
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
    logger.error('student', 'create-loan-action-failed', { error: errorMessage, input });
    
    return {
      success: false,
      message: `Error al crear la solicitud de préstamo: ${errorMessage}`
    };
  }
};
