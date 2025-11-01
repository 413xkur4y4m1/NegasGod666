'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get, push, set } from 'firebase/database';
import { logger } from '@/lib/logger';
import {
  Debt,
  Material,
  User,
  ChatbotOutputSchema,
  MaterialSchema,
  LoanSchema,
  Loan,
} from '@/lib/types';

// --- Esquemas y Tipos ---
const ChatbotInputSchema = z.object({
  userQuery: z.string(),
  studentMatricula: z.string(),
  selectedMaterialId: z.string().optional(),
  materia: z.string().optional(),
});

const AiMaterialCardSchema = z.object({ id: z.string(), name: z.string() });
const AiOutputSchema = z.object({
  intent: z.enum(['materialSearch', 'historyInquiry', 'greeting', 'clarification', 'loanContinuation', 'loanRequest']),
  responseText: z.string(),
  materialOptions: z.array(AiMaterialCardSchema).optional(),
});
const StudentChatPromptInputSchema = z.object({
  userQuery: z.string(),
  studentName: z.string(),
  availableMaterials: z.string(),
  studentLoans: z.string(),
  studentDebts: z.string(),
});

const dateExtractorPrompt = ai.definePrompt({
  name: 'dateExtractorPrompt',
  input: { schema: z.object({ userText: z.string(), currentDate: z.string() }) },
  output: { schema: z.object({ extractedDate: z.string().describe('Fecha en formato AAAA-MM-DD') }) },
  prompt: `Eres un experto en extraer fechas de texto. Analiza el siguiente texto y devuelve la fecha mencionada en formato AAAA-MM-DD. Hoy es {{currentDate}}. Texto del usuario: "{{userText}}"`,
});

// --- PROMPT MEJORADO Y DETALLADO ---
const studentChatRouterPrompt = ai.definePrompt({
  name: 'studentChatRouterPrompt',
  input: { schema: StudentChatPromptInputSchema },
  output: { schema: AiOutputSchema },
  prompt: `
    Eres GASTROBOT, un asistente de IA para el pañol de Gastronomía. Tu nombre es GASTROBOT y hablas con {{studentName}}.
    Tu objetivo es analizar su consulta ({{userQuery}}), clasificarla en una intención y formular una respuesta útil y amigable.

    INFORMACIÓN DE CONTEXTO:
    - Materiales Disponibles: \`\`\`json {{availableMaterials}} \`\`\`
    - Sus Préstamos Activos: \`\`\`json {{studentLoans}} \`\`\`
    - Sus Adeudos Pendientes: \`\`\`json {{studentDebts}} \`\`\`

    REGLAS DE INTENCIÓN Y RESPUESTA:

    1. **greeting**: Si el usuario solo saluda o inicia una conversación casual.
       - **Acción**: Responde con un saludo amigable. Ejemplo: "¡Hola, {{studentName}}! Soy GASTROBOT, ¿en qué te puedo ayudar hoy?"

    2. **materialSearch**: Si el usuario busca, pide o pregunta por la disponibilidad de utensilios.
       - **Acción**: Analiza la consulta, busca en 'availableMaterials' y, si encuentras coincidencias, llena el campo 'materialOptions' en el JSON de salida. En 'responseText', informa al usuario que encontraste opciones.

    3. **historyInquiry**: Si el usuario pregunta sobre su historial, préstamos o adeudos.
       - **Acción**: Genera un 'responseText' que resuma la información de 'studentLoans' y 'studentDebts'. **IMPORTANTE: Debes formatear este resumen en HTML.**
       - **Ejemplo de formato para la respuesta HTML**:
         \`\`\`html
         <p>¡Claro! Aquí tienes un resumen de tu historial:</p>
         <h4>Préstamos Activos</h4>
         {{#if studentLoans}}
           {{#each studentLoans}}
             <div style="border: 1px solid #ddd; border-left: 5px solid #007bff; padding: 10px; margin-bottom: 10px;">
               <p><strong>Material:</strong> {{this.name}}</p>
               <p><strong>Estado:</strong> <span style="color: #007bff;">{{this.state}}</span></p>
             </div>
           {{/each}}
         {{else}}
           <p>No tienes préstamos activos en este momento.</p>
         {{/if}}
         <h4>Adeudos Pendientes</h4>
         {{#if studentDebts}}
           {{#each studentDebts}}
             <div style="border: 1px solid #ddd; border-left: 5px solid #dc3545; padding: 10px; margin-bottom: 10px;">
               <p><strong>Material:</strong> {{this.name}}</p>
               <p><strong>Monto:</strong> <span style="color: #dc3545;">{{this.amount}}</span></p>
             </div>
           {{/each}}
         {{else}}
           <p>¡Felicidades! No tienes ningún adeudo pendiente.</p>
         {{/if}}
         \`\`\`
       - Adapta el mensaje si solo tiene préstamos, solo adeudos, o ninguno.

    4. **clarification**: Si la pregunta es ambigua o no la puedes entender.
       - **Acción**: Pide al usuario que reformule su pregunta de una manera amable.

    TAREA: Analiza la consulta '{{userQuery}}' y genera una respuesta JSON válida que se ajuste al esquema, usando las reglas anteriores.
  `,
});

// --- FLUJO PRINCIPAL CONVERSACIONAL ---
export async function chatbotAssistedLoanRequest(input: z.infer<typeof ChatbotInputSchema>): Promise<z.infer<typeof ChatbotOutputSchema>> {
  try {
    const [materialsSnap, usersSnap] = await Promise.all([
      get(ref(db, 'materiales')),
      get(ref(db, 'alumnos')),
    ]);

    const allMaterials = Object.values(materialsSnap.val() || {}).map(m => MaterialSchema.parse(m));
    const currentUser = (Object.values(usersSnap.val() || {}) as User[]).find(u => u.matricula === input.studentMatricula);

    if (!currentUser) {
      return { intent: 'clarification', responseText: 'No pude verificar tu matrícula. Contacta a un administrador.' };
    }

    if (input.selectedMaterialId && input.materia) {
      const material = allMaterials.find(m => m.id === input.selectedMaterialId);
      if (!material) {
        return { intent: 'clarification', responseText: 'Ese material ya no parece estar disponible. ¿Buscamos otro?' };
      }

      const { output: dateExtraction } = await dateExtractorPrompt({
        userText: input.userQuery,
        currentDate: new Date().toISOString().split('T')[0],
      });

      if (!dateExtraction?.extractedDate) {
        return {
          intent: 'loanContinuation',
          responseText: 'No entendí muy bien la fecha. ¿Podrías intentar de nuevo? Por ejemplo, "mañana" o "el próximo viernes".',
        };
      }

      const newLoanRef = push(ref(db, 'prestamos'));
      const newLoanData = {
        id_prestamo: newLoanRef.key!,
        id_material: material.id,
        nombre_material: material.nombre,
        matricula_alumno: currentUser.matricula,
        nombre_alumno: currentUser.nombre,
        fecha_prestamo: new Date().toISOString().split('T')[0],
        fecha_limite: dateExtraction.extractedDate,
        estado: 'activo' as const,
        materia: input.materia,
        precio_unitario: material.precioUnitario || 0,
      };

      await set(newLoanRef, newLoanData);
      logger.action('student', 'loan-created', { matricula: currentUser.matricula, material: material.id });

      return {
        intent: 'loanContinuation',
        responseText: `✅ ¡Listo, ${currentUser.nombre.split(' ')[0]}! He registrado tu préstamo de "${material.nombre}" para "${input.materia}", a devolver el ${dateExtraction.extractedDate}. ¡Pasa a recogerlo!`,
      };
    }

    if (input.selectedMaterialId) {
      return {
        intent: 'loanContinuation',
        responseText: 'Excelente elección. ¿Para qué materia lo necesitas?',
      };
    }

    const [loansSnap, debtsSnap] = await Promise.all([
      get(ref(db, 'prestamos')),
      get(ref(db, 'adeudos')),
    ]);
    const studentLoans: Loan[] = Object.values(loansSnap.val() || []).map(l => LoanSchema.parse(l)).filter((l): l is Loan => l.matriculaAlumno === input.studentMatricula);
    const studentDebts = Object.values(debtsSnap.val() || {}).filter((d: any) => d.matricula_alumno === input.studentMatricula) as Debt[];

    const { output: aiResponse } = await studentChatRouterPrompt({
      userQuery: input.userQuery,
      studentName: currentUser.nombre,
      availableMaterials: JSON.stringify(allMaterials.map(m => ({ id: m.id, name: m.nombre }))),
      studentLoans: JSON.stringify(studentLoans.map(l => ({ name: l.nombreMaterial, state: l.status }))),
      studentDebts: JSON.stringify(studentDebts.map(d => ({ name: d.nombreMaterial, amount: d.monto }))),
    });

    const validatedAiResponse = AiOutputSchema.parse(aiResponse);
    const finalResponse: z.infer<typeof ChatbotOutputSchema> = {
      intent: validatedAiResponse.intent,
      responseText: validatedAiResponse.responseText,
    };

    if (validatedAiResponse.intent === 'materialSearch' && validatedAiResponse.materialOptions) {
      finalResponse.materialOptions = validatedAiResponse.materialOptions
        .map(option => allMaterials.find(m => m.id === option.id))
        .filter((m): m is Material => Boolean(m))
        .map(m => ({ id: m.id, name: m.nombre }));
    }

    logger.chatbot('student', finalResponse.intent, { matricula: input.studentMatricula, query: input.userQuery });
    return finalResponse;

  } catch (error) {
    const typedError = error instanceof Error ? error : new Error('Error desconocido');
    logger.error('student', 'chatbot-processing-failed', typedError, { rawError: error });
    return {
      intent: 'clarification',
      responseText: 'Lo siento, un error inesperado me impidió procesar tu solicitud. Intenta de nuevo más tarde.',
    };
  }
}
