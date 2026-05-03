import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export async function analyzeJobMatch(resume: string, jobDescription: string) {
    const result = await generateObject({
        model: google('gemini-1.5-flash'),
        // Define exactly what the AI must return
        schema: z.object({
            matchScore: z.number().min(0).max(100),
            missingKeywords: z.array(z.string()),
            executiveSummary: z.string(),
        }),
        system: `You are a strict technical recruiter. Analyze the resume against the job description.`,
        prompt: `RESUME: ${resume}\n\nJOB DESCRIPTION: ${jobDescription}`,
    });

    return result.object;
}