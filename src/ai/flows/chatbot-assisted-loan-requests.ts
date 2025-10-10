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

const ChatbotAssistedLoanInputSchema = z.object({
  userQuery: z.string().describe('The user query describing the desired material for loan.'),
  studentName: z.string().optional().describe('The name of the student requesting the loan.'),
  studentMatricula: z.string().optional().describe('The matricula of the student requesting the loan.'),
});

export type ChatbotAssistedLoanInput = z.infer<typeof ChatbotAssistedLoanInputSchema>;

const MaterialCardSchema = z.object({
  id: z.string().describe('The unique identifier of the material.'),
  name: z.string().describe('The name of the material.'),
  imageUrl: z.string().optional().describe('Optional AI-generated image URL for the material.'),
});

const ChatbotAssistedLoanOutputSchema = z.object({
  materialOptions: z.array(MaterialCardSchema).describe('A list of potential material options based on the user query, with optional AI-generated images.'),
  loanDetails: z.string().optional().describe('Details related to the loan such as fees and conditions')
});

export type ChatbotAssistedLoanOutput = z.infer<typeof ChatbotAssistedLoanOutputSchema>;


export async function chatbotAssistedLoanRequest(input: ChatbotAssistedLoanInput): Promise<ChatbotAssistedLoanOutput> {
  return chatbotAssistedLoanFlow(input);
}

const materialSearchPrompt = ai.definePrompt({
  name: 'materialSearchPrompt',
  input: {schema: ChatbotAssistedLoanInputSchema},
  output: {schema: ChatbotAssistedLoanOutputSchema},
  prompt: `You are a helpful assistant designed to help students request material loans. A student will provide a query and you will find relavent materials from the database.

  Student Name: {{{studentName}}}
  Student Matricula: {{{studentMatricula}}}
  Student Query: {{{userQuery}}}

  Based on the query, you will return an array of materials. Each Material in the materialOptions array MUST have an id and a name. If you can generate a suitable image, include an imageUrl with data URI. If no suitable materials exist, return an empty materialOptions array.
  Also add any loan details that the student needs to know.
  `,
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
