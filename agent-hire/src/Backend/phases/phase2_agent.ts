import { generateObject, type GenerateObjectResult } from 'ai'; // Import generateObject and its type
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod'; // Import z from zod
import { tailoringTools } from './phase2_tools';

const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});


const agentOutputSchema = z.object({
    tailoringRecommendation: z.string().describe('The AI\'s recommendation after analyzing and potentially tailoring the resume.'),
    toolUsed: z.boolean().describe('True if the tailor_resume_section tool was called.'),
    toolOutput: z.any().optional().describe('The output from the tailoring tool, if used.'),
    finalResumeSummary: z.string().optional().describe('A suggested new resume summary after tailoring.')
});

export async function runAgentWithTools(resume: string, jobDesc: string): Promise<GenerateObjectResult<z.infer<typeof agentOutputSchema>>> { // Specify return type
    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not set.");
        }
        if (!resume || !jobDesc) {
            throw new Error("Resume and job description cannot be empty.");
        }


        const result = await generateObject({
            model: openrouter('meta-llama/llama-3.3-70b-instruct'),
            schema: agentOutputSchema,
            messages: [
                {
                    role: 'system',
                    content: `You are an AI Job Assistant. Your goal is to help the user tailor their resume.
                    Analyze the provided resume and job description.
                    If you identify a clear opportunity to improve the resume's alignment with the job description by integrating specific keywords into a 'summary' or similar introductory section, you MUST use the 'tailor_resume_section' tool.

                    After performing any necessary tool actions (or if no tool is needed), provide a concise, polite, and helpful final summary to the user, including details of any tools used and their outputs.
                    Format your final response as a structured summary.`,
                },
                {
                    role: 'user',
                    content: `My resume says: "${resume}". The job wants: "${jobDesc}". Please help me tailor my resume summary.`,
                },
            ],
        });

        console.log("Agent result:", result);
        return result;

    } catch (error) {
        console.error("Error in runAgentWithTools:", error);
        throw error;
    }
}