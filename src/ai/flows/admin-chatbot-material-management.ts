// admin-chatbot-material-management.ts
'use server';

/**
 * @fileOverview AI agent for assisting administrators in managing and adding new materials to the inventory.
 *
 * - `manageMaterial`: A function that processes the admin's request to add or manage materials.
 * - `ManageMaterialInput`: The input type for the manageMaterial function.
 * - `ManageMaterialOutput`: The return type for the manageMaterial function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ManageMaterialInputSchema = z.object({
  action: z
    .string()
    .describe(
      'The action to perform, such as adding a new material or updating an existing one.'
    ),
  materialDetails: z
    .string()
    .describe(
      'Details about the material, including name, quantity, and other relevant information.'
    ),
});

export type ManageMaterialInput = z.infer<typeof ManageMaterialInputSchema>;

const ManageMaterialOutputSchema = z.object({
  confirmation: z
    .string()
    .describe(
      'A confirmation message indicating whether the material was successfully added or updated.'
    ),
  materialId: z
    .string()
    .optional()
    .describe(
      'The unique identifier of the material, if applicable.  This is not applicable for updates.'
    ),
});

export type ManageMaterialOutput = z.infer<typeof ManageMaterialOutputSchema>;

export async function manageMaterial(input: ManageMaterialInput): Promise<ManageMaterialOutput> {
  return manageMaterialFlow(input);
}

const prompt = ai.definePrompt({
  name: 'manageMaterialPrompt',
  input: {schema: ManageMaterialInputSchema},
  output: {schema: ManageMaterialOutputSchema},
  prompt: `You are an AI assistant helping the administrator to manage the material inventory.

  The administrator wants to perform the following action: {{{action}}}
  Here are the material details provided by the administrator: {{{materialDetails}}}

  Please process the request and respond with a confirmation message.
  If a new material was added, include the material ID in the response.
  Ensure that you generate a response that can be parsed as JSON by the client.`,
});

const manageMaterialFlow = ai.defineFlow(
  {
    name: 'manageMaterialFlow',
    inputSchema: ManageMaterialInputSchema,
    outputSchema: ManageMaterialOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
