'use server';
/**
 * @fileOverview Generates statistical reports and predicts user behavior based on the provided data.
 *
 * - generateStatisticalReport - A function that generates the statistical report.
 * - StatisticalReportInput - The input type for the generateStatisticalReport function.
 * - StatisticalReportOutput - The return type for the generateStatisticalReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StatisticalReportInputSchema = z.object({
  materialData: z.string().describe('JSON string containing the materials data.'),
  loanData: z.string().describe('JSON string containing the loan data.'),
  userData: z.string().describe('JSON string containing the user data.'),
});
export type StatisticalReportInput = z.infer<typeof StatisticalReportInputSchema>;

const StatisticalReportOutputSchema = z.object({
  report: z.string().describe('The generated statistical report.'),
});
export type StatisticalReportOutput = z.infer<typeof StatisticalReportOutputSchema>;

export async function generateStatisticalReport(input: StatisticalReportInput): Promise<StatisticalReportOutput> {
  return statisticalReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'statisticalReportPrompt',
  input: {schema: StatisticalReportInputSchema},
  output: {schema: StatisticalReportOutputSchema},
  prompt: `You are an AI assistant that generates statistical reports based on the provided data.

You will receive data about materials, loans, and users in JSON format. Analyze this data to identify patterns in material damage, predict user behavior concerning loan defaults or timely returns, and provide insights into which materials are most prone to damage or loss.

Material Data: {{{materialData}}}
Loan Data: {{{loanData}}}
User Data: {{{userData}}}

Based on this data, generate a comprehensive statistical report that includes:
- Most frequently damaged materials and potential reasons.
- Predictions about user behavior related to loan defaults, damage, and return behavior.
- Recommendations for improving resource allocation, reducing damage, and preventing defaults.

Ensure the report is well-structured, clear, and actionable. Do not use bullet points, just plain text.

Output the statistical report in plain text format.
`,
});

const statisticalReportFlow = ai.defineFlow(
  {
    name: 'statisticalReportFlow',
    inputSchema: StatisticalReportInputSchema,
    outputSchema: StatisticalReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
