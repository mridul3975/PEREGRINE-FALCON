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
                system: `You are a senior technical resume writer. Rewrite the resume to be fully optimized for the provided job description.
                Use the job description to select relevant keywords, metrics, and accomplishments. Return only the rewritten resume text in markdown.
                Include these sections when possible: Professional Summary, Work Experience, Projects, Skills, Technical Skills, Certifications, and Education (optional).
                Make the resume results-oriented, ATS-friendly, and aligned to the target role. Do not include analysis, explanations, or commentary.`,
                messages: [
                    {
                        role: 'user',
                        content: `Act as an expert technical resume writer. Based on the job description below for a [Job Title] at [Company Name], rewrite my current resume to be more impactful and better tailored to this role.

Optimize for ATS: Incorporate keywords naturally from the job description.

Professional Summary: Create a 3-4 sentence summary highlighting years of experience, key skills, and top achievements relevant to this role.

Work Experience: Rewrite bullet points to be results-oriented rather than task-oriented. Use strong action verbs and include metrics/numbers to quantify achievements.

Projects: If the resume contains project experience, convert it into a clear projects section with outcomes and relevant technologies.

Skills Section: Create a section highlighting key technical skills and tools from the job description.

Education: Include an education section if it exists, otherwise omit it.

Target Job Description:
${jobDescription}

My Current Resume:
${fullResumeData}`,
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