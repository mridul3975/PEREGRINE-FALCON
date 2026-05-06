// src/phases/phase3_loop_agent.ts
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { tailoringTools } from './phase2_tools';
import { db } from '../../db/connection';
import { discoveredJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';

const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

const jobDecisionSchema = z.object({
    isGoodMatch: z.boolean().describe('True if the job is a good match for the resume, false otherwise.'),
    reasoning: z.string().describe('Detailed reasoning for the match decision.'),
    recommendedResumeSection: z.string().optional().describe('If a good match, suggest a resume section to tailor (e.g., "Summary", "Experience").'),
    keywordsToIntegrate: z.array(z.string()).optional().describe('If tailoring is recommended, a list of keywords from the job description to integrate into the resume.'),
    applicationNote: z.string().optional().describe('If a good match, a short, personalized application note for this job.')
});

export type JobDecision = z.infer<typeof jobDecisionSchema>;

export async function analyzeAndProcessJob(
    jobId: number,
    jobSummary: { title: string; company: string; summary: string },
    userResume: string,
    existingMessages: any[] = []
): Promise<JobDecision | null> {
    try {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not set.");
        }

        const decisionResult = await generateText({
            model: openrouter('openai/gpt-3.5-turbo'),
            tools: tailoringTools,
            system: `You are an intelligent job agent. Your task is to analyze a given job summary against the user's resume.
                    Determine if it's a 'Good Match'. If it is, provide detailed reasoning, suggest a resume section to tailor (if applicable), list keywords, and generate a personalized application note.
                    You can recommend tailoring the resume by identifying relevant keywords and suggesting which section to update.
                    If tailoring is useful, you should use the available tailoring tools.
                    After any tool calls are complete, your final output MUST be a JSON object only, with no markdown, no commentary, and no surrounding text.`,
            messages: [
                {
                    role: 'system',
                    content: `You do not execute tailoring tools unless needed. Use them only when they help tailor the resume for the job.`,
                },
                ...existingMessages,
                {
                    role: 'user',
                    content: `Here is the job summary:\nTitle: ${jobSummary.title}\nCompany: ${jobSummary.company}\nSummary: ${jobSummary.summary}\n\nHere is my resume:\n${userResume}\n\nBased on this, is it a good match? If so, what recommendations do you have for tailoring and what should the application note be?`,
                },
            ],
        });

        const extractJson = (text: string) => {
            try {
                return JSON.parse(text);
            } catch {
                const match = text.match(/({[\s\S]*})/m);
                if (!match || !match[1]) {
                    throw new Error(`Unable to extract JSON from model output: ${text}`);
                }
                return JSON.parse(match[1]);
            }
        };

        const rawDecision = extractJson(decisionResult.text);
        const decision = jobDecisionSchema.parse(rawDecision);

        await db.update(discoveredJobs)
            .set({
                status: decision.isGoodMatch ? 'good_match' : 'bad_match',
                aiAnalysis: decision.reasoning,
                applicationNote: decision.applicationNote,
            })
            .where(eq(discoveredJobs.id, jobId));

        console.log(`[Phase 3] Job ID ${jobId} processed. Good match: ${decision.isGoodMatch}`);



        return decision;

    } catch (error) {
        console.error(`Error in analyzeAndProcessJob for Job ID ${jobId}:`, error);
        throw error;
    }
}