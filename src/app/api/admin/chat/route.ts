
import { manageMaterial } from '@/ai/flows/admin-chatbot-material-management';
import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/admin/chat:
 *   post:
 *     summary: Interacts with the admin chatbot AI flow for materials management.
 *     description: Receives a user query, processes it through the manageMaterial flow, and returns the AI's response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userQuery:
 *                 type: string
 *                 description: The query text from the administrator for managing materials.
 *                 example: "Busca el material 'Aceite de Oliva'"
 *     responses:
 *       200:
 *         description: Successful response from the AI.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad Request, userQuery is missing.
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
 *                   example: "La consulta está vacía."
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
    const { userQuery } = await request.json();

    if (!userQuery) {
      return NextResponse.json({ success: false, message: 'La consulta está vacía.' }, { status: 400 });
    }

    // Execute the flow and wait for the complete result.
    const result = await manageMaterial({ userQuery });

    // Explicitly return the result as a single JSON object.
    // NextResponse.json handles JSON.stringify and sets the correct headers.
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error crítico en la API Route de admin/chat:", error);
    return NextResponse.json(
      { success: false, message: 'Ocurrió un error inesperado en el servidor.' },
      { status: 500 }
    );
  }
}
