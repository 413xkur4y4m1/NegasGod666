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
  userQuery: z
    .string()
    .describe(
      'The admin query, can be a request to add material or a question about the data.'
    ),
  context: z.object({
      loans: z.string().optional().describe("JSON string of all loans."),
      users: z.string().optional().describe("JSON string of all users."),
      materials: z.string().optional().describe("JSON string of all materials."),
  }).optional()
});

export type ManageMaterialInput = z.infer<typeof ManageMaterialInputSchema>;

const ManageMaterialOutputSchema = z.object({
  response: z
    .string()
    .describe(
      'A confirmation message or the answer to the admin query.'
    ),
  isDataQuery: z.boolean().describe("Whether the query was a question about data."),
});

export type ManageMaterialOutput = z.infer<typeof ManageMaterialOutputSchema>;

export async function manageMaterial(input: ManageMaterialInput): Promise<ManageMaterialOutput> {
  return manageMaterialFlow(input);
}

const prompt = ai.definePrompt({
  name: 'manageMaterialPrompt',
  input: {schema: ManageMaterialInputSchema},
  output: {schema: ManageMaterialOutputSchema},
  prompt: `You are an AI assistant helping an administrator manage a university's material loan system.

Your tasks are to:
1.  **Answer questions** about the current state of loans, users, and materials based on the provided JSON data context.
2.  **Extract information** to add or update materials in the inventory.

- If the user asks a question (e.g., "who has active loans?", "show me users with debts"), analyze the provided JSON data from the 'context' object (loans, users, materials) and provide a clear, concise answer. Set 'isDataQuery' to true.
- If the user wants to add or update a material (e.g., "add 10 chef knives"), extract the relevant details. Respond with a confirmation like "Action to add material '[details]' has been processed." Set 'isDataQuery' to false.

Admin query: {{{userQuery}}}

Data Context (if available):
- Loans: {{{context.loans}}}
- Users: {{{context.users}}}
- Materials: {{{context.materials}}}
`,
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
