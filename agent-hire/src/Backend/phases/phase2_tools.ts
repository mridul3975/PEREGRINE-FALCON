import { createOpenAI } from '@ai-sdk/openai';
import { tool, generateText } from 'ai';
import { z } from 'zod';

const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

export const tailoringTools = {
    // Tool 1: A simple helper to show the AI can get external data
    get_current_date: tool({
        description: 'Returns the current date and time.',
        inputSchema: z.object({}), // No input needed from AI
        execute: async () => {
            return { date: new Date().toISOString() };
        },
    }),

    // Tool 2: The core logic for tailoring
    tailor_resume_autonomously: tool({
        description: 'Analyzes a full resume against a job description, identifies mismatched sections, and returns the optimized resume content.',
        inputSchema: z.object({
            fullResumeData: z.string().describe('The entire text or JSON string of the current resume'),
            jobDescription: z.string().describe('The target job description to align with'),
        }),
        execute: async ({ fullResumeData, jobDescription }) => {
            console.log(`[SERVER] AI is analyzing and tailoring the full resume...`);

            const result = await generateText({
                model: openrouter('openai/gpt-3.5-turbo'),
                system: `You are a resume tailoring assistant. Analyze the provided resume and job description, and return an improved or optimized resume summary plus specific recommendations for tailoring.
                Provide the full optimized resume content in the response.`,
                messages: [
                    {
                        role: 'user',
                        content: `Resume:\n${fullResumeData}\n\nJob Description:\n${jobDescription}`,
                    },
                ],
            });

            return {
                status: 'success',
                updatesMade: ['Summary', 'Experience', 'Skills'],
                optimizedContent: result.text,
            };
        },
    }),
};