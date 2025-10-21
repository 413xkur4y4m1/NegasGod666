
import { chatbotAssistedLoanRequest } from '@/ai/flows/chatbot-assisted-loan-requests';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RequestSchema = z.object({
    userQuery: z.string(),
    studentMatricula: z.string(),
});

/**
 * @swagger
 * /api/student/chat:
 *   post:
 *     summary: Interacts with the student chatbot AI flow.
 *     description: Receives a student query and matricula, processes it through the chatbotAssistedLoanRequest flow, and returns the AI's response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userQuery:
 *                 type: string
 *                 description: The query text from the student.
 *                 example: "quiero un prestamo de cuchillo"
 *               studentMatricula:
 *                 type: string
 *                 description: The student's ID (matricula).
 *                 example: "244650"
 *     responses:
 *       200:
 *         description: Successful response from the AI.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatbotOutput'
 *       400:
 *         description: Bad Request, invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Datos de entrada inválidos."
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Ocurrió un error inesperado en el servidor."
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
        return NextResponse.json({ success: false, message: 'Datos de entrada inválidos.', issues: validation.error.issues }, { status: 400 });
    }

    const { userQuery, studentMatricula } = validation.data;

    // Execute the flow and wait for the complete result.
    const result = await chatbotAssistedLoanRequest({ userQuery, studentMatricula });

    // Explicitly return the result as a single JSON object.
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error crítico en la API Route de student/chat:", error);
    return NextResponse.json(
      { success: false, message: 'Ocurrió un error inesperado en el servidor.' },
      { status: 500 }
    );
  }
}
