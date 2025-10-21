'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { logger } from '@/lib/logger';
import { Loan, Debt, Material, User, LoanSchema, DebtSchema, MaterialSchema, UserSchema } from '@/lib/types';

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
  loansHistory: z.array(LoanSchema).optional(),
  debtsHistory: z.array(DebtSchema).optional(),
});

// --- PROMPT DE LA IA (sin cambios) ---
const studentChatRouterPrompt = ai.definePrompt({
  name: 'studentChatRouterPrompt',
  input: { schema: z.object({ /* ... */ }) },
  output: { schema: z.object({ 
      intent: z.enum(['materialSearch', 'historyInquiry', 'greeting', 'clarification']),
      responseText: z.string(),
      materialOptions: z.array(AiMaterialCardSchema).optional(),
  })},
  prompt: `Eres un asistente amigable...`
});

// --- FUNCIÓN PRINCIPAL DEL FLUJO ---
export async function chatbotAssistedLoanRequest(input: z.infer<typeof ChatbotInputSchema>): Promise<z.infer<typeof ChatbotOutputSchema>> {
  try {
    const [materialsSnap, loansSnap, debtsSnap, usersSnap] = await Promise.all([
      get(ref(db, 'materiales')),
      get(ref(db, 'prestamos')),
      get(ref(db, 'adeudos')),
      get(ref(db, 'alumno'))
    ]);

    // --- PARSE AND TRANSFORM DATA ---
    const allMaterials = Object.entries(materialsSnap.val() || {})
        .map(([id, m]) => MaterialSchema.safeParse({ id, ...(m as object) }))
        .filter(p => p.success)
        .map(p => (p as any).data);
    
    const allUsers = Object.values(usersSnap.val() || {})
        .map(u => UserSchema.safeParse(u))
        .filter(p => p.success)
        .map(p => (p as any).data);

    const studentLoans = Object.values(loansSnap.val() || {})
        .map(loan => LoanSchema.safeParse(loan).data)
        .filter((loan): loan is Loan => !!loan && loan.matriculaAlumno === input.studentMatricula);

    const studentDebts = Object.values(debtsSnap.val() || {})
        .map(debt => DebtSchema.safeParse(debt).data)
        .filter((debt): debt is Debt => !!debt && debt.matriculaAlumno === input.studentMatricula);

    const currentUser = allUsers.find(u => u.matricula === input.studentMatricula);
    const studentName = currentUser?.nombre || 'alumno';

    const { output: aiResponse } = await studentChatRouterPrompt({
        userQuery: input.userQuery,
        studentName,
        availableMaterials: JSON.stringify(allMaterials.map(m => ({ id: m.id, name: m.nombre }))),
        studentLoans: JSON.stringify(studentLoans.map(l => ({ name: l.nombreMaterial, state: l.status }))), // CORRECTED: from l.estado to l.status
        studentDebts: JSON.stringify(studentDebts.map(d => ({ name: d.nombreMaterial, amount: d.monto }))),
    });

    if (!aiResponse) throw new Error("La IA no pudo procesar la solicitud.");

    const finalResponse: z.infer<typeof ChatbotOutputSchema> = {
      intent: aiResponse.intent,
      responseText: aiResponse.responseText,
    };

    if (aiResponse.intent === 'materialSearch' && aiResponse.materialOptions) {
      finalResponse.materialOptions = aiResponse.materialOptions
        .map(option => {
          const realMaterial = allMaterials.find(m => m.id === option.id);
          if (!realMaterial) return null;

          const enrichedOption: z.infer<typeof EnrichedMaterialCardSchema> = {
            id: option.id,
            name: option.name,
          };
          return enrichedOption;
        })
        .filter(Boolean as any);
    } else if (aiResponse.intent === 'historyInquiry') {
      finalResponse.loansHistory = studentLoans;
      finalResponse.debtsHistory = studentDebts;
    }
    
    logger.chatbot('student', finalResponse.intent, { matricula: input.studentMatricula, query: input.userQuery });

    return finalResponse;

  } catch (error) {
    logger.error('student', 'chatbot-error', { error: error instanceof Error ? error.message : error });
    return {
        intent: 'clarification',
        responseText: 'Lo siento, tuve un problema al procesar tu solicitud. ¿Podrías intentar de nuevo?'
    };
  }
}
