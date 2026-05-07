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
                    After any tool calls are complete, your final output MUST be a JSON object only, with no markdown, no commentary, and no surrounding text.
                    Example output format: {"isGoodMatch": true, "reasoning": "...", "recommendedResumeSection": "Summary", "keywordsToIntegrate": ["React","TypeScript","Zustand"], "applicationNote": "..."}`,
            messages: [
                ...existingMessages,
                {
                    role: 'user',
                    content: `Here is the job summary:\nTitle: ${jobSummary.title}\nCompany: ${jobSummary.company}\nSummary: ${jobSummary.summary}\n\nHere is my resume:\n${userResume}\n\nBased on this, is it a good match? If so, what recommendations do you have for tailoring and what should the application note be?`,
                },
            ],
        });

        const extractJson = (text: string) => {
            const raw = text?.trim() ?? '';
            if (raw) {
                try {
                    return JSON.parse(raw);
                } catch {
                    const match = raw.match(/({[\s\S]*})/m);
                    if (match && match[1]) {
                        return JSON.parse(match[1]);
                    }
                }
            }
            throw new Error(`Unable to extract JSON from model output: ${raw}`);
        };

        const extractFromToolResults = (toolResults: any[]) => {
            for (const tool of toolResults || []) {
                const output = tool?.output ?? tool?.result;
                if (!output) continue;

                if (typeof output === 'string' && output.trim()) {
                    try {
                        return extractJson(output);
                    } catch {
                        const match = output.match(/({[\s\S]*})/m);
                        if (match && match[1]) {
                            try {
                                return JSON.parse(match[1]);
                            } catch {
                                continue;
                            }
                        }
                    }
                }

                if (typeof output === 'object' && output !== null) {
                    if (output.isGoodMatch !== undefined && output.reasoning !== undefined) {
                        return output;
                    }
                    if (output.optimizedContent && typeof output.optimizedContent === 'string') {
                        try {
                            return extractJson(output.optimizedContent);
                        } catch {
                            // fall through
                        }
                    }
                    if (output.text && typeof output.text === 'string') {
                        try {
                            return extractJson(output.text);
                        } catch {
                            // fall through
                        }
                    }
                }
            }
            return null;
        };

        const inferDecisionLocally = (): JobDecision => {
            const normalize = (text: string) =>
                text
                    .toLowerCase()
                    .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()\[\]"]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

            const resumeText = normalize(userResume);
            const summaryText = normalize(jobSummary.summary);
            const titleText = normalize(jobSummary.title);

            const resumeWords = new Set(resumeText.split(' ').filter((word) => word.length > 2));
            const summaryWords = summaryText.split(' ').filter((word) => word.length > 2);
            const titleTokens = titleText.split(' ').filter((word) => word.length > 2);

            const seniorityKeywords = ['junior', 'midlevel', 'mid-level', 'senior', 'lead', 'manager', 'principal'];
            const domainKeywords = ['frontend', 'backend', 'machine', 'data', 'design', 'devops', 'infrastructure', 'mobile', 'product', 'cloud', 'api'];
            const stopwords = new Set(['with', 'and', 'experience', 'skills', 'years', 'role', 'required', 'strong', 'company', 'team', 'work', 'using', 'knowledge', 'tools']);

            const titleMatchCount = titleTokens.filter((word) => resumeWords.has(word)).length;
            const seniorityMatch = seniorityKeywords.some((keyword) => titleText.includes(keyword) && resumeText.includes(keyword));
            const domainMatch = domainKeywords.some((keyword) =>
                (titleText.includes(keyword) || summaryText.includes(keyword)) && resumeText.includes(keyword)
            );

            const skillCandidates = summaryWords.filter(
                (word) => !stopwords.has(word) && !titleTokens.includes(word) && !domainKeywords.includes(word)
            );
            const skillMatches = Array.from(new Set(skillCandidates)).filter((word) => resumeWords.has(word));

            const isGoodMatch =
                (titleMatchCount >= 1 || seniorityMatch) &&
                skillMatches.length >= 3 &&
                (domainMatch || titleMatchCount >= 2);

            return {
                isGoodMatch,
                reasoning: isGoodMatch
                    ? `The resume matches the job title/seniority, contains ${skillMatches.length} relevant keyword matches, and aligns with the same domain language.`
                    : `The resume does not clearly match enough title/seniority, required skills, or domain language from the job description.`,
                recommendedResumeSection: isGoodMatch ? 'Summary' : 'Experience',
                keywordsToIntegrate: skillMatches.slice(0, 5),
                applicationNote: isGoodMatch
                    ? 'This resume is a strong fit; emphasize the matching skills, seniority, and domain language in your summary.'
                    : 'Consider revising the resume to better reflect the required title, skills, and domain language.',
            };
        };

        let decision: JobDecision;
        try {
            let rawDecision: any;

            try {
                rawDecision = extractJson(decisionResult.text);
            } catch {
                rawDecision = extractFromToolResults((decisionResult as any).toolResults ?? []);
            }

            if (!rawDecision) {
                rawDecision = inferDecisionLocally();
            }

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
            console.error('Phase 3 decisionResult:', JSON.stringify(decisionResult, null, 2));
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