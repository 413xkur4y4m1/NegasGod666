'use server';

import { db } from '@/lib/firebase';
import { ref, push, set, get, child, update, runTransaction } from 'firebase/database';
import type { Loan, Material } from './types';

export async function createLoan(loanData: Partial<Loan>) {
    if (!loanData.id_material || !loanData.matricula_alumno) {
        throw new Error('Datos de préstamo incompletos.');
    }

    const newLoanRef = push(ref(db, 'prestamos'));
    const loanId = newLoanRef.key;

    if (!loanId) {
        throw new Error('No se pudo generar un ID para el préstamo.');
    }

    const finalLoanData: Loan = {
        id_prestamo: loanId,
        id_material: loanData.id_material,
        nombre_material: loanData.nombre_material || 'N/A',
        matricula_alumno: loanData.matricula_alumno,
        nombre_alumno: loanData.nombre_alumno || 'N/A',
        fecha_prestamo: loanData.fecha_prestamo || new Date().toISOString().split('T')[0],
        fecha_limite: loanData.fecha_limite || 'N/A',
        estado: 'pendiente', // Loans start as pending approval
        materia: loanData.materia || 'N/A',
        precio_unitario: loanData.precio_unitario || 0,
    };
    
    // Decrease material stock
    const materialRef = ref(db, `materiales/${finalLoanData.id_material}`);
    await runTransaction(materialRef, (material) => {
        if (material) {
            if (material.cantidad > 0) {
                material.cantidad--;
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
    updates[`/alumno/${finalLoanData.matricula_alumno}/prestamos/${loanId}`] = finalLoanData;

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
