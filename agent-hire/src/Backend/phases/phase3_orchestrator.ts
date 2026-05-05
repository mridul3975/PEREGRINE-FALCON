// src/phases/phase3_orchestrator.ts (New file for orchestration logic)
import { analyzeAndProcessJob } from './phase3_loop_agent';
import { db } from '../../db/connection';
import { discoveredJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';

export type IncomingJobSummary = {
    title: string;
    company: string;
    summary: string;
};

export async function orchestrateJobProcessing(
    jobSummaries: IncomingJobSummary[],
    userResume: string
): Promise<{ processedCount: number; newJobIds: number[] }> {
    const newJobIds: number[] = [];

    for (const job of jobSummaries) {
        const insertedJob = await db.insert(discoveredJobs).values({
            title: job.title,
            company: job.company,
            summary: job.summary,
            status: 'pending_review',
        }).returning({ id: discoveredJobs.id });

        const jobId = insertedJob[0]?.id;
        if (!jobId) {
            throw new Error('Failed to insert job record');
        }
        newJobIds.push(jobId);

        try {
            await analyzeAndProcessJob(jobId, job, userResume);
        } catch (error) {
            console.error(`Failed to analyze job ${jobId}:`, error);
            await db.update(discoveredJobs).set({ status: 'bad_match' }).where(eq(discoveredJobs.id, jobId));
        }
    }

    return { processedCount: jobSummaries.length, newJobIds };
}