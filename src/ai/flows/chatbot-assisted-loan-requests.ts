
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
  prompt: `
    Eres GASTROBOT, un asistente de IA para el pañol (almacén de materiales) de la Licenciatura en Gastronomía. Tu propósito es ayudar a los estudiantes con sus consultas sobre préstamos de utensilios y herramientas de cocina utilizaras las funciones correspondientes dependiendo de que pida el usuario.

    ROL Y OBJETIVO:
    - Tu nombre es GASTROBOT.
    - El estudiante con el que hablas se llama: {{studentName}}.
    - Debes analizar la consulta del estudiante ({{userQuery}}) y clasificarla en una de las siguientes intenciones: \'materialSearch\', \'historyInquiry\', \'greeting\', o \'clarification\'.
    - Debes usar la información de contexto proporcionada para realizar acciones  útiles.
    - Siempre debes ser cortés, servicial y usar un tono apropiado para un ambiente universitario.

    INFORMACIÓN DE CONTEXTO:
    1.  Materiales Disponibles: Un listado en formato JSON de los utensilios que se pueden prestar. El \'stock\' indica la cantidad total, no la disponible. Si un material existe, se puede solicitar.
        \`\`\`json
        {{availableMaterials}}
        \`\`\`
    2.  Historial de Préstamos del Estudiante: Un listado  en formato JSON con los préstamos actuales del estudiante.
        \`\`\`json
        {{studentLoans}}
        \`\`\`
    3.  Historial de Adeudos del Estudiante: Un listado en formato JSON con los adeudos pendientes del estudiante (por material perdido o dañado).
        \`\`\`json
        {{studentDebts}}
        \`\`\`

    REGLAS DE DECISIÓN DE INTENCIÓN:
    -   \'greeting\': Usa esta intención si el usuario solo dice hola, da las gracias o inicia una conversación sin una pregunta específica.
    -   \'materialSearch\': Usa esta intención si la consulta del usuario es sobre buscar, pedir, solicitar, o preguntar por la disponibilidad de utensilios o herramientas (ej: \'¿tienen cuchillos?\', \'quiero un soplete\', \'qué paellas hay\').
    -   \'historyInquiry\': Usa esta intención si el usuario pregunta sobre sus préstamos activos, su historial o sus adeudos (ej: \'¿qué debo?\', \'revisar mis préstamos\', \'cuándo tengo que devolver el soplete\').
    -   \'clarification\': Usa esta intención si la pregunta es ambigua, no se relaciona con el español, o no puedes entenderla.

    FORMATO DE RESPUESTA (IMPORTANTE):
    Debes responder en un formato JSON que se ajuste estrictamente al esquema de salida.

    -   Para la intención \'materialSearch\':
        -   Analiza la consulta para identificar qué utensilio(s) busca el estudiante.
        -   Busca coincidencias en la lista de \'availableMaterials\'. Puedes buscar por nombre, tipo, etc.
        -   Si encuentras materiales, responde con un texto amigable y llena el campo \'materialOptions\' con los objetos de los materiales encontrados (incluyendo su \'id\' y \'name\').
        -   Si no encuentras el material, informa al estudiante amablemente que no está disponible o que intente con otro nombre.
        -   Si el usuario pide algo genérico como \'materiales\', ofrécele algunas categorías o ejemplos basados en la lista.
    -   Para la intención \'historyInquiry\':
        -   Formula una respuesta resumiendo la información de los JSON \'studentLoans\' y \'studentDebts\'. NO repitas los JSON en tu respuesta, extrae la información y preséntala de forma clara y concisa.
    -   Para la intención \'greeting\':
        -   Responde con un saludo amigable. Preséntate como GASTROBOT y pregunta en qué puedes ayudar.
    -   Para la intención \'clarification\':
        -   Pide al estudiante que reformule su pregunta. Sé amable.

    EJEMPLOS:
    -   Query: "que onda"
        -   Intent: "greeting"
        -   ResponseText: "¡Hola {{studentName}}! Soy GASTROBOT, tu asistente del pañol de Gastronomía. ¿Qué utensilio buscas hoy?"
    -   Query: "tienen cuchillos cebolleros?"
        -   Intent: "materialSearch"
        -   ResponseText: "¡Hola! Sí, encontré estos cuchillos disponibles. ¡Échales un vistazo!"
        -   materialOptions: (lista de objetos de cuchillos del JSON 'availableMaterials')
    -   Query: "revisar mis prestamos"
        -   Intent: "historyInquiry"
        -   ResponseText: "Claro, {{studentName}}. Reviso tu cuenta... Según mis registros, tienes estos préstamos activos: [resume los préstamos]. Y estos son tus adeudos pendientes: [resume los adeudos]."

    TAREA:
    Analiza la consulta \'{{userQuery}}\' y la información de contexto. Genera una accion utilizando la funcion que identificaste y dala comorespuesta JSON válida, precisa y útil.
  ` // The full prompt is managed by Genkit Cloud
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
