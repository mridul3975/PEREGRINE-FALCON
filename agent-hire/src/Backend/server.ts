import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { tailoringTools } from './phases/phase2_tools';

export async function runAgentWithTools(resume: string, jobDesc: string) {
    const result = await generateText({
        model: google('gemini-1.5-flash'),
        tools: tailoringTools,
        // maxSteps allows the AI to call a tool AND then speak again in one go
        maxSteps: 5,
        system: `You are an AI Job Assistant. 
    Your goal is to help the user tailor their resume.
    If you see missing keywords, use the 'tailor_resume_section' tool to fix the summary.`,
        prompt: `My resume says: "${resume}". The job wants: "${jobDesc}". Please help me.`,
    });

    return result;
}