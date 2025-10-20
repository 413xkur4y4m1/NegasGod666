
// src/ai/flows/chatbot-assisted-loan-requests.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { logger } from '@/lib/logger';
import type { Loan, Debt, Material, User } from '@/lib/types';

// --- ESQUEMAS ZOD ---
const ChatbotInputSchema = z.object({
  userQuery: z.string().describe('La pregunta o solicitud del alumno.'),
  studentMatricula: z.string().describe('La matrícula del alumno que realiza la consulta.'),
});

const AiMaterialCardSchema = z.object({
  id: z.string().describe('El ID único del material.'),
  name: z.string().describe('El nombre del material.'),
});

const EnrichedMaterialCardSchema = AiMaterialCardSchema.extend({
  imageUrl: z.string().optional().describe('La URL de la imagen del material.'),
});

export const ChatbotOutputSchema = z.object({
  intent: z.enum(['materialSearch', 'historyInquiry', 'greeting', 'clarification']),
  responseText: z.string(),
  materialOptions: z.array(EnrichedMaterialCardSchema).optional(),
  loansHistory: z.array(z.custom<Loan>()).optional(),
  debtsHistory: z.array(z.custom<Debt>()).optional(),
});

// --- PROMPT DE LA IA ---
const studentChatRouterPrompt = ai.definePrompt({
  name: 'studentChatRouterPrompt',
  input: { schema: z.object({ /* ... */ }) }, // Sin cambios
  output: { schema: z.object({ 
      intent: z.enum(['materialSearch', 'historyInquiry', 'greeting', 'clarification']),
      responseText: z.string(),
      materialOptions: z.array(AiMaterialCardSchema).optional(),
  })},
  prompt: `Eres un asistente amigable...` // Sin cambios
});

// --- FUNCIÓN PRINCIPAL DEL FLUJO ---
export async function chatbotAssistedLoanRequest(input: z.infer<typeof ChatbotInputSchema>): Promise<z.infer<typeof ChatbotOutputSchema>> {
  try {
    // 1. Obtener datos de Firebase
    const [materialsSnap, loansSnap, debtsSnap, usersSnap] = await Promise.all([
      get(ref(db, 'materiales')),
      get(ref(db, 'prestamos')),
      get(ref(db, 'adeudos')),
      get(ref(db, 'usuarios'))
    ]);

    const allMaterials: Record<string, Material> = materialsSnap.val() || {};
    const allLoans = loansSnap.val() || {};
    const allDebts = debtsSnap.val() || {};
    const allUsers: Record<string, User> = usersSnap.val() || {};

    // 2. Filtrar datos del alumno
    const currentUser = Object.values(allUsers).find(u => u.matricula === input.studentMatricula);
    const studentName = currentUser?.nombre || 'alumno';
    const studentLoans = Object.values(allLoans).filter((loan: any): loan is Loan => loan.matriculaAlumno === input.studentMatricula);
    const studentDebts = Object.values(allDebts).filter((debt: any): debt is Debt => debt.matriculaAlumno === input.studentMatricula);

    // 3. Llamar a la IA
    const { output: aiResponse } = await studentChatRouterPrompt({
        userQuery: input.userQuery,
        studentName,
        availableMaterials: JSON.stringify(Object.values(allMaterials).map(m => ({ id: m.id, name: m.nombre }))),
        studentLoans: JSON.stringify(studentLoans.map(l => ({ name: l.nombreMaterial, state: l.estado }))),
        studentDebts: JSON.stringify(studentDebts.map(d => ({ name: d.nombreMaterial, amount: d.monto }))),
    });

    if (!aiResponse) throw new Error("La IA no pudo procesar la solicitud.");

    // 4. Construir la respuesta final
    const finalResponse: z.infer<typeof ChatbotOutputSchema> = {
      intent: aiResponse.intent,
      responseText: aiResponse.responseText,
    };

    if (aiResponse.intent === 'materialSearch' && aiResponse.materialOptions) {
      // FIX: Se construye el objeto manualmente para asegurar la compatibilidad de tipos.
      finalResponse.materialOptions = aiResponse.materialOptions
        .map(option => {
          const realMaterial = allMaterials[option.id];
          if (!realMaterial) return null;

          // Se crea un objeto que cumple explícitamente con el schema
          const enrichedOption: z.infer<typeof EnrichedMaterialCardSchema> = {
            id: option.id,
            name: option.name,
          };

          // Se añade la propiedad opcional solo si existe
          if (realMaterial.imageUrl) {
            enrichedOption.imageUrl = realMaterial.imageUrl;
          }

          return enrichedOption;
        })
        .filter(Boolean as any); // Se eliminan los nulos
    } else if (aiResponse.intent === 'historyInquiry') {
      finalResponse.loansHistory = studentLoans;
      finalResponse.debtsHistory = studentDebts;
    }
    
    logger.chatbot('student', finalResponse.intent, { matricula: input.studentMatricula, query: input.userQuery });

    return finalResponse;

  } catch (error) {
    logger.error('student', 'chatbot-error', error);
    return {
        intent: 'clarification',
        responseText: 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías intentar de nuevo?'
    };
  }
}
