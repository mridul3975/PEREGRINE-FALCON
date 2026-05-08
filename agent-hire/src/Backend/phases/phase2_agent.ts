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
            system: `You are an expert technical resume writer. Your task is to rewrite a resume so it is highly tailored to a target job description.
            You MUST call the tool named 'tailor_resume_autonomously' with the full resume and job description.
            The final response must be the improved resume text only, formatted in markdown, with no analysis, commentary, or tool metadata.
            Focus on results-oriented bullets, ATS keyword integration, and a stronger professional summary.
            Use the following structure if helpful: Professional Summary, Work Experience, Projects, Skills, Technical Skills, Certifications, Education (optional).
            If the resume includes education, preserve it; if not, omit the section. Do not send partial updates or suggestions alone.`,
            messages: [
                {
                    role: 'user',
                    content: `Act as an expert technical resume writer. Based on the job description below for a [Job Title] at [Company Name], please rewrite my current resume to be more impactful and better tailored to this role.

Optimize for ATS: Incorporate keywords naturally from the job description.

Professional Summary: Create a 3-4 sentence summary highlighting my years of experience, key skills, and top achievements relevant to this role.

Work Experience: Rewrite my bullet points to be results-oriented rather than task-oriented. Use strong action verbs and include metrics/numbers to quantify achievements.

Projects: If the resume contains project experience, convert it into a clear projects section with outcomes and relevant technologies.

Skills Section: Create a section highlighting key technical skills and tools from the job description.

Education: Include an education section if it exists, otherwise omit it.

Target Job Description:
${jobDesc}

My Current Resume:
${resume}`,
                },
            ],
        });

        console.log("Agent result:", result.text);
        return result;

    } catch (error) {
        console.error("Error in runAgentWithTools:", error);
        throw error;
    }
}