
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { logger } from '@/lib/logger';
// CORRECTED: Import all data structures, including the chatbot-specific ones, from the single source of truth.
import { 
    Loan, 
    Debt, 
    Material, 
    User, 
    LoanSchema, 
    DebtSchema, 
    MaterialSchema, 
    UserSchema,
    ChatbotOutputSchema, // Imported from types.ts
    EnrichedMaterialCardSchema // Imported from types.ts
} from '@/lib/types';

// --- INPUT SCHEMA ---
const ChatbotInputSchema = z.object({
  userQuery: z.string().describe('La pregunta o solicitud del alumno.'),
  studentMatricula: z.string().describe('La matrícula del alumno que realiza la consulta.'),
});

// --- AI-SPECIFIC SCHEMAS (Internal to this flow) ---

// Schema for the raw material options from the AI model itself.
const AiMaterialCardSchema = z.object({
  id: z.string().describe('El ID único del material.'),
  name: z.string().describe('El nombre del material.'),
});

// Schema for the raw, direct output from the AI model.
const AiOutputSchema = z.object({
  intent: z.enum(['materialSearch', 'historyInquiry', 'greeting', 'clarification']),
  responseText: z.string(),
  materialOptions: z.array(AiMaterialCardSchema).optional(),
});

// --- AI PROMPT ---
const studentChatRouterPrompt = ai.definePrompt({
  name: 'studentChatRouterPrompt',
  input: { schema: z.object({ /* ... */ }) }, // Input is passed dynamically
  output: { schema: AiOutputSchema },
  prompt: `Eres un asistente amigable...` // The full prompt is managed by Genkit Cloud
});

// --- MAIN FLOW FUNCTION ---
export async function chatbotAssistedLoanRequest(input: z.infer<typeof ChatbotInputSchema>): Promise<z.infer<typeof ChatbotOutputSchema>> {
  try {
    const [materialsSnap, loansSnap, debtsSnap, usersSnap] = await Promise.all([
      get(ref(db, 'materiales')),
      get(ref(db, 'prestamos')),
      get(ref(db, 'adeudos')),
      get(ref(db, 'alumno'))
    ]);

    // --- PARSE AND TRANSFORM DATABASE DATA ---
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

    // --- CALL THE AI MODEL ---
    const { output: aiResponse } = await studentChatRouterPrompt({
        userQuery: input.userQuery,
        studentName,
        availableMaterials: JSON.stringify(allMaterials.map(m => ({ id: m.id, name: m.nombre }))),
        studentLoans: JSON.stringify(studentLoans.map(l => ({ name: l.nombreMaterial, state: l.status }))),
        studentDebts: JSON.stringify(studentDebts.map(d => ({ name: d.nombreMaterial, amount: d.monto }))),
    });

    // --- VALIDATE AND PROCESS AI RESPONSE ---
    const validationResult = AiOutputSchema.safeParse(aiResponse);

    if (!validationResult.success) {
      const validationError = new Error("La respuesta de la IA no tiene el formato esperado.");
      (validationError as any).invalidResponse = aiResponse;
      (validationError as any).zodIssues = validationResult.error.issues;
      throw validationError;
    }

    const validatedAiResponse = validationResult.data;

    // --- CONSTRUCT THE FINAL, STRICTLY-TYPED RESPONSE ---
    const finalResponse: z.infer<typeof ChatbotOutputSchema> = {
      intent: validatedAiResponse.intent,
      responseText: validatedAiResponse.responseText,
    };

    if (validatedAiResponse.intent === 'materialSearch' && validatedAiResponse.materialOptions) {
      finalResponse.materialOptions = validatedAiResponse.materialOptions
        .map(option => {
          const realMaterial = allMaterials.find(m => m.id === option.id);
          if (!realMaterial) return null; // Filter out options for materials that no longer exist
          return { id: option.id, name: option.name }; // Return the enriched object
        })
        .filter(Boolean as any);
    } else if (validatedAiResponse.intent === 'historyInquiry') {
      finalResponse.loansHistory = studentLoans;
      finalResponse.debtsHistory = studentDebts;
    }
    
    logger.chatbot('student', finalResponse.intent, { matricula: input.studentMatricula, query: input.userQuery });

    return finalResponse;

  } catch (error) {
    console.error("\n--- ERROR EN CHATBOT DE ESTUDIANTE ---", error);
    logger.error('student', 'chatbot-processing-failed', { message: error instanceof Error ? error.message : String(error) });

    // Return a user-friendly error response that conforms to the output schema
    return {
        intent: 'clarification',
        responseText: 'Lo siento, un error inesperado me impidió procesar tu solicitud. Por favor, intenta de nuevo más tarde.'
    };
  }
}
