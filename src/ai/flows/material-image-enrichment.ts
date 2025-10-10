'use server';

/**
 * @fileOverview Enriches material data with AI-generated images.
 *
 * - enrichMaterialWithImage - A function that enriches material data with an AI-generated image.
 * - MaterialImageEnrichmentInput - The input type for the enrichMaterialWithImage function.
 * - MaterialImageEnrichmentOutput - The return type for the enrichMaterialWithImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MaterialImageEnrichmentInputSchema = z.object({
  materialName: z.string().describe('The name of the material to generate an image for.'),
});
export type MaterialImageEnrichmentInput = z.infer<typeof MaterialImageEnrichmentInputSchema>;

const MaterialImageEnrichmentOutputSchema = z.object({
  imageUrl: z.string().describe('The data URI of the generated image.'),
});
export type MaterialImageEnrichmentOutput = z.infer<typeof MaterialImageEnrichmentOutputSchema>;

export async function enrichMaterialWithImage(
  input: MaterialImageEnrichmentInput
): Promise<MaterialImageEnrichmentOutput> {
  return materialImageEnrichmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'materialImageEnrichmentPrompt',
  input: {schema: MaterialImageEnrichmentInputSchema},
  output: {schema: MaterialImageEnrichmentOutputSchema},
  prompt: `Generate a photorealistic image of a {{{materialName}}}. The image should be a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'.`,
});

const materialImageEnrichmentFlow = ai.defineFlow(
  {
    name: 'materialImageEnrichmentFlow',
    inputSchema: MaterialImageEnrichmentInputSchema,
    outputSchema: MaterialImageEnrichmentOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      prompt: `Generate an image of a ${input.materialName}`,
      model: 'googleai/imagen-4.0-fast-generate-001',
    });

    if (!media || !media.url) {
      throw new Error('Could not generate image.');
    }

    return {imageUrl: media.url};
  }
);
