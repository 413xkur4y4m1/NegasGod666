'use server';

import { z } from 'zod';
import { ref, get, update, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';

const CreateLoanSchema = z.object({
  materialId: z.string(),
  studentMatricula: z.string(),
});

const ReturnLoanSchema = z.object({
    loanId: z.string(),
    materialId: z.string(),
});

/**
 * Crea un nuevo préstamo y descuenta la cantidad del inventario.
 */
export async function createLoan(input: z.infer<typeof CreateLoanSchema>) {
  try {
    const validation = CreateLoanSchema.safeParse(input);
    if (!validation.success) {
      throw new Error('Datos de entrada inválidos.');
    }

    const { materialId, studentMatricula } = validation.data;
    const materialRef = ref(db, `materiales/${materialId}`);
    const materialSnap = await get(materialRef);

    if (!materialSnap.exists()) {
      return { success: false, message: 'El material solicitado no existe.' };
    }

    const material = materialSnap.val();

    // 1. VERIFICAR STOCK
    if (material.cantidad <= 0) {
      // CORREGIDO: Se cambió logger.warn por logger.error, que es un método existente.
      logger.error('student', 'loan-request-no-stock', { materialId });
      return { success: false, message: `Lo siento, no queda stock de ${material.nombre}.` };
    }

    // 2. CREAR EL PRÉSTAMO
    const newLoan = {
      id_material: materialId,
      nombreMaterial: material.nombre,
      matriculaAlumno: studentMatricula,
      fecha_prestamo: serverTimestamp(),
      status: 'activo',
    };
    
    const loansRef = ref(db, 'prestamos');
    const newLoanRef = push(loansRef);
    await update(newLoanRef, newLoan);

    // 3. ACTUALIZAR INVENTARIO (Disminuir cantidad)
    await update(materialRef, {
      cantidad: material.cantidad - 1,
    });

    logger.action('student', 'loan-created', { materialId, studentMatricula });
    return { success: true, message: `Préstamo de ${material.nombre} registrado correctamente.` };

  } catch (error) {
    logger.error('system', 'create-loan-failed', { message: error instanceof Error ? error.message : 'Error desconocido' });
    return { success: false, message: 'Ocurrió un error al registrar el préstamo.' };
  }
}

/**
 * Marca un préstamo como devuelto y aumenta la cantidad en el inventario.
 */
export async function returnLoan(input: z.infer<typeof ReturnLoanSchema>) {
    try {
        const validation = ReturnLoanSchema.safeParse(input);
        if (!validation.success) {
          throw new Error('Datos de entrada inválidos para la devolución.');
        }

        const { loanId, materialId } = validation.data;
        const loanRef = ref(db, `prestamos/${loanId}`);
        const materialRef = ref(db, `materiales/${materialId}`);

        const [loanSnap, materialSnap] = await Promise.all([get(loanRef), get(materialRef)]);

        if (!loanSnap.exists() || !materialSnap.exists()) {
            return { success: false, message: 'El préstamo o el material asociado no existen.' };
        }

        // 1. ACTUALIZAR ESTADO DEL PRÉSTAMO
        await update(loanRef, {
            status: 'devuelto',
            fecha_devolucion: serverTimestamp(),
        });

        // 2. ACTUALIZAR INVENTARIO (Aumentar cantidad)
        const material = materialSnap.val();
        await update(materialRef, {
            cantidad: material.cantidad + 1,
        });

        logger.action('system', 'loan-returned', { loanId, materialId });
        return { success: true, message: 'Devolución registrada correctamente.' };

    } catch (error) {
        logger.error('system', 'return-loan-failed', { message: error instanceof Error ? error.message : 'Error desconocido' });
        return { success: false, message: 'Ocurrió un error al registrar la devolución.' };
    }
}
