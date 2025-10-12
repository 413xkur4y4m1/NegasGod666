// src/ai/flows/chatbot-assisted-loan-requests.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for processing loan requests via a chatbot interface.
 *
 * The flow takes a user query as input and returns a structured loan request, potentially including AI-generated images for materials.
 *
 * @interface ChatbotAssistedLoanInput - Defines the input schema for the chatbot-assisted loan request flow.
 * @interface ChatbotAssistedLoanOutput - Defines the output schema for the chatbot-assisted loan request flow.
 * @function chatbotAssistedLoanRequest - The main function to initiate the chatbot-assisted loan request flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { logger } from '@/lib/logger';

const ChatbotAssistedLoanInputSchema = z.object({
  userQuery: z.string().describe('The user query describing the desired material for loan.'),
  studentName: z.string().optional().describe('The name of the student requesting the loan.'),
  studentMatricula: z.string().optional().describe('The matricula of the student requesting the loan.'),
  availableMaterials: z.string().optional().describe('JSON string containing available materials from the database'),
});

export type ChatbotAssistedLoanInput = z.infer<typeof ChatbotAssistedLoanInputSchema>;

const MaterialCardSchema = z.object({
  id: z.string().describe('The unique identifier of the material.'),
  name: z.string().describe('The name of the material.'),
  imageUrl: z.string().optional().describe('Optional AI-generated image URL for the material.'),
  quantity: z.number().optional().describe('Available quantity of the material'),
  condition: z.string().optional().describe('Current condition of the material'),
});

const ChatbotAssistedLoanOutputSchema = z.object({
  materialOptions: z.array(MaterialCardSchema).describe('A list of potential material options based on the user query, with optional AI-generated images.'),
  loanDetails: z.string().optional().describe('Details related to the loan such as fees and conditions')
});

export type ChatbotAssistedLoanOutput = z.infer<typeof ChatbotAssistedLoanOutputSchema>;

export async function chatbotAssistedLoanRequest(input: ChatbotAssistedLoanInput): Promise<ChatbotAssistedLoanOutput> {
  try {
    // Obtener materiales de Firebase
    const materialsSnapshot = await get(ref(db, 'materiales'));
    const availableMaterials = materialsSnapshot.val() || {};

    logger.chatbot('student', 'material-search', {
      query: input.userQuery,
      studentMatricula: input.studentMatricula,
      availableMaterialsCount: Object.keys(availableMaterials).length
    });

    // Agregar los materiales disponibles al input
    const enhancedInput = {
      ...input,
      availableMaterials: JSON.stringify(availableMaterials)
    };

    const result = await chatbotAssistedLoanFlow(enhancedInput);

    // Filtrar y enriquecer los resultados con datos reales
    const enrichedMaterialOptions = result.materialOptions
      .map(material => {
        const realMaterial = availableMaterials[material.id];
        if (realMaterial) {
          return {
            id: material.id,
            name: material.name,
            quantity: Number(realMaterial.cantidad) || 0,
            condition: String(realMaterial.estado || 'No especificado'),
            imageUrl: realMaterial.imageUrl?.startsWith('/uploads/') ? realMaterial.imageUrl : `/uploads/default-${material.id}.jpg`
          };
        }
        return null;
      })
      .filter((material): material is NonNullable<typeof material> => material !== null);

    return {
      ...result,
      materialOptions: enrichedMaterialOptions
    };
  } catch (error) {
    logger.error('student', 'material-search-error', error);
    throw error;
  }
}

const materialSearchPrompt = ai.definePrompt({
  name: 'materialSearchPrompt',
  input: {schema: ChatbotAssistedLoanInputSchema},
  output: {schema: ChatbotAssistedLoanOutputSchema},
  prompt: `You are a helpful assistant designed to help students request material loans. A student will provide a query and you will find relevant materials from the database.

  Available Materials: {{{availableMaterials}}}
  Student Name: {{{studentName}}}
  Student Matricula: {{{studentMatricula}}}
  Student Query: {{{userQuery}}}

  Based on the query and available materials in the database:
  1. Search through the available materials JSON for relevant matches
  2. Consider variations and synonyms of the requested items
  3. Check material availability (cantidad > 0)
  4. Include only materials that match the student's search intent
  5. Provide helpful loan details and conditions

  Return a well-structured response with:
  - materialOptions: Array of matching materials from the database
  - loanDetails: Helpful information about loan conditions and any specific requirements

  Each Material in the materialOptions array MUST have an id and a name. If you can generate a suitable image, include an imageUrl with data URI. If no suitable materials exist, return an empty materialOptions array.`
});

const chatbotAssistedLoanFlow = ai.defineFlow(
  {
    name: 'chatbotAssistedLoanFlow',
    inputSchema: ChatbotAssistedLoanInputSchema,
    outputSchema: ChatbotAssistedLoanOutputSchema,
  },
  async input => {
    const {output} = await materialSearchPrompt(input);
    return output!;
  }
);
