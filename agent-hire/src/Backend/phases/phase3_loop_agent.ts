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
                    Determine whether the resume is a strong match for the job using these rules:
                    1. Match the job title or seniority keyword (for example: Junior, Mid-level, Senior, Lead, Manager).
                    2. Match at least 3 required technical skills or keywords from the job summary.
                    3. Match the same domain or role language (for example, frontend, backend, machine learning, infrastructure, product design).
                    Set isGoodMatch to true only when these criteria are clearly satisfied.
                    Set isGoodMatch to false only when there is a clear mismatch in title/seniority, skills, or domain language.
                    If it is a good match, provide detailed reasoning, suggest a resume section to tailor (if applicable), list relevant keywords, and generate a personalized application note.
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

        let decision: JobDecision;
        try {
            const rawDecision = extractJson(decisionResult.text);
            decision = jobDecisionSchema.parse(rawDecision);
        } catch (parseError) {
            const errorDetails = parseError instanceof Error ? parseError.message : String(parseError);
            const fallbackAnalysis = `Phase 3 parse failed. Raw model output: ${decisionResult.text}`;
            await db.update(discoveredJobs)
                .set({
                    status: 'bad_match',
                    aiAnalysis: fallbackAnalysis,
                    applicationNote: `Failed to interpret AI output: ${errorDetails}`,
                })
                .where(eq(discoveredJobs.id, jobId));

            console.error(`Phase 3 parse error for Job ID ${jobId}:`, errorDetails);
            throw new Error(`Unable to parse Phase 3 AI response: ${errorDetails}`);
        }

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