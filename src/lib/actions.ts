'use server';

import { db } from '@/lib/firebase';
import { ref, push, set, get, child, update, runTransaction } from 'firebase/database';
import type { Loan, Material } from './types';

export async function createLoan(loanData: Partial<Loan>) {
    if (!loanData.idMaterial || !loanData.matriculaAlumno) {
        throw new Error('Datos de préstamo incompletos.');
    }

    const newLoanRef = push(ref(db, 'prestamos'));
    const loanId = newLoanRef.key;

    if (!loanId) {
        throw new Error('No se pudo generar un ID para el préstamo.');
    }

    const finalLoanData: Loan = {
        idPrestamo: loanId,
        idMaterial: loanData.idMaterial,
        nombreMaterial: loanData.nombreMaterial || 'N/A',
        matriculaAlumno: loanData.matriculaAlumno,
        nombreAlumno: loanData.nombreAlumno || 'N/A',
        fechaPrestamo: loanData.fechaPrestamo || new Date().toISOString().split('T')[0],
        fechaLimite: loanData.fechaLimite || 'N/A',
        status: 'pendiente', // Loans start as pending approval
        materia: loanData.materia || 'N/A',
        precioUnitario: loanData.precioUnitario || 0,
    };
    
    // Decrease material stock
    const materialRef = ref(db, `materiales/${finalLoanData.idMaterial}`);
    await runTransaction(materialRef, (material) => {
        if (material) {
            if (material.disponibles > 0) { // Changed from cantidad
                material.disponibles--;
            } else {
                // Abort transaction
                return;
            }
        }
        return material;
    });

    // Write to general loans and student's loans
    const updates: { [key: string]: any } = {};
    updates[`/prestamos/${loanId}`] = finalLoanData;
    updates[`/alumnos/${finalLoanData.matriculaAlumno}/prestamos/${loanId}`] = finalLoanData; // Corrected path to /alumnos/

    await update(ref(db), updates);

    return finalLoanData;
}

export async function createMaterial(materialData: Omit<Material, 'id'>) {
    const materialId = materialData.nombre.toLowerCase().replace(/\s+/g, '_');
    const materialRef = ref(db, `materiales/${materialId}`);

    const snapshot = await get(materialRef);
    if(snapshot.exists()) {
        throw new Error("Un material con este nombre ya existe.");
    }
    
    await set(materialRef, materialData);

    return { ...materialData, id: materialId };
}
