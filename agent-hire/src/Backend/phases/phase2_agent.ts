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

            system: `You are an AI Job Assistant. Your goal is to help the user tailor their resume.
            Analyze the provided resume and job description. If you identify clear opportunities to improve the resume's alignment with the job description by integrating specific keywords into a 'summary' or similar introductory section, you MUST use the 'tailor_resume_autonomously' tool.
            Only use get_current_date if you explicitly need the current date.

            After performing any necessary tool actions (or if no tool is needed), provide a concise, polite, and helpful final summary to the user, including details of any tools used and their outputs.`,

            messages: [
                { role: 'user', content: `My resume says: "${resume}". The job wants: "${jobDesc}". Please help me tailor my resume summary.` },
            ],

        });

        console.log("Agent result:", result.text);
        return result;

    } catch (error) {
        console.error("Error in runAgentWithTools:", error);
        throw error;
    }
}