import { generateText, streamText, tool } from 'ai'; // Added streamText and CoreMessage for future reference
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { tailoringTools } from './phase2_tools'; // Ensure this path is correct

const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function runAgentWithTools(resume: string, jobDesc: string) {
    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not set.");
        }
        if (!resume || !jobDesc) {
            throw new Error("Resume and job description cannot be empty.");
        }

        const result = await generateText({
            model: openrouter('openai/gpt-3.5-turbo'),

            tools: tailoringTools,

            system: `You are an AI Job Assistant. Your goal is to produce an improved version of the user's resume that is better aligned with the given job description.
            Analyze the resume and job description. When you can, you MUST use the 'tailor_resume_autonomously' tool to generate the revised resume text.
            Only use get_current_date if you explicitly need the current date.

            After using the tool, your final response should be the full improved resume text (or an optimized resume summary), not just advice.`,

            messages: [
                { role: 'user', content: `My resume says: "${resume}". The job wants: "${jobDesc}". Please produce the improved resume text and a brief explanation of what was changed.` },
            ],

        });

        console.log("Agent result:", result.text);
        return result;

    } catch (error) {
        console.error("Error in runAgentWithTools:", error);
        throw error;
    }
}