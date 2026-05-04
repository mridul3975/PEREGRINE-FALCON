import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';


const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function analyzeJobMatch(resume: string, jobDescription: string) {
    try {
        if (!resume || !jobDescription) {
            throw new Error("Resume and job description cannot be empty.");
        }


        if (!process.env.OPENROUTER_API_KEY) {
            console.error("OPENROUTER_API_KEY is not set.");
            throw new Error("AI provider API key is not configured.");
        }

        const result = await generateObject({
            model: openrouter('meta-llama/llama-3.3-70b-instruct'),

            output: 'object',
            schema: z.object({
                matchScore: z.number().int().min(0).max(100).describe('A score from 0-100 indicating how well the resume matches the job description, with 100 being a perfect match.'),
                missingKeywords: z.array(z.string()).describe('An array of important keywords or phrases from the job description that were not clearly found in the resume.'),
                executiveSummary: z.string().describe('A concise, professional summary of the resume-job description match, highlighting key strengths and areas for improvement.'),
            }),
            system: `You are a highly efficient and strict AI recruiter bot. Your sole function is to analyze a given resume against a job description and output ONLY a valid JSON object according to the provided schema. Do not include any conversational text, greetings, apologies, or explanations before or after the JSON. The JSON must be the complete and only output.`,
            prompt: `Analyze the following job application:

Resume:
---
${resume}
---

Job Description:
---
${jobDescription}
---

Based on this analysis, provide:
1. A 'matchScore' (0-100).
2. 'missingKeywords' from the job description not in the resume.
3. An 'executiveSummary' of the match.`,

        });

        console.log("LLM Analysis Raw Result:", result); // For debugging
        console.log("LLM Analysis Object:", result.object);
        return result.object;

    } catch (error) {
        console.error("Error during LLM analysis in analyzeJobMatch:", error);
        // Re-throw the error so the server's try-catch can handle it
        throw error;
    }
}