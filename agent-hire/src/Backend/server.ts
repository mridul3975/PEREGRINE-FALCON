import { config } from 'dotenv';
import { analyzeJobMatch } from './phases/phase1_puppet';
import { runAgentWithTools } from './phases/phase2_agent';
config();
import { orchestrateJobProcessing, type IncomingJobSummary } from './phases/phase3_orchestrator';
import { discoveredJobs } from '../db/schema';
import { db } from '../db/connection';
import { sql, eq } from 'drizzle-orm';

const server = Bun.serve({
    port: 3000,
    async fetch(req: Request) {
        const url = new URL(req.url);

        if (req.method === 'POST' && url.pathname === '/api/v1/analyze') {
            try {
                if (!process.env.OPENROUTER_API_KEY) {
                    console.error('OPENROUTER_API_KEY is not set.');
                    return new Response(JSON.stringify({ error: 'Server configuration error: API Key not found.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }

                const { resume, jobDescription } = await req.json();
                if (typeof resume !== 'string' || typeof jobDescription !== 'string' || !resume || !jobDescription) {
                    return new Response(JSON.stringify({ error: 'Invalid input: "resume" and "jobDescription" must be non-empty strings.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const analysisResult = await analyzeJobMatch(resume, jobDescription);
                return Response.json(analysisResult);

            } catch (error) {
                console.error('Error processing /api/v1/analyze request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage, details: 'Failed to analyze job match.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (req.method === 'POST' && url.pathname === '/api/v2/tailor') {
            try {
                if (!process.env.OPENROUTER_API_KEY) {
                    console.error('OPENROUTER_API_KEY for Phase 2 is not set.');
                    return new Response(JSON.stringify({ error: 'Server configuration error: API Key not found for tailoring agent.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
                }

                const { resume, jobDescription, resumeSectionToTailor } = await req.json();
                if (typeof resume !== 'string' || typeof jobDescription !== 'string' || !resume || !jobDescription) {
                    return new Response(JSON.stringify({ error: 'Invalid input: "resume" and "jobDescription" must be non-empty strings.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const agentResult = await runAgentWithTools(resume, jobDescription);
                const toolResults = (agentResult.toolResults ?? []) as any;
                const optimizedContent = Array.isArray(toolResults)
                    ? toolResults.map((item: any) => item?.output?.optimizedContent ?? item?.output ?? item?.result).find(Boolean)
                    : toolResults?.output?.optimizedContent ?? toolResults?.output ?? toolResults?.result;

                return Response.json({
                    text: agentResult.text,
                    finalMessage: optimizedContent || agentResult.text || '',
                    optimizedContent,
                    toolResults: agentResult.toolResults,
                    finishReason: agentResult.finishReason,
                    usage: agentResult.usage,
                });
            } catch (error) {
                console.error('Error processing /api/v2/tailor request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage, details: 'Failed to run tailoring agent.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }


        if (req.method === 'POST' && url.pathname === '/api/v3/process-jobs') {
            try {
                const { jobs, resume } = await req.json();

                if (!Array.isArray(jobs) || jobs.length === 0 || !resume || typeof resume !== 'string') {
                    return new Response(JSON.stringify({ error: 'Invalid input: "jobs" array and "resume" string are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const result = await orchestrateJobProcessing(jobs as IncomingJobSummary[], resume);
                return Response.json({ message: `Successfully initiated processing for ${result.processedCount} jobs.`, newJobIds: result.newJobIds });

            } catch (error) {
                console.error('Error processing /api/v3/process-jobs request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage, details: 'Failed to orchestrate job processing.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }


        if (req.method === 'GET' && url.pathname === '/api/v3/jobs') {
            try {
                const allJobs = await db.select().from(discoveredJobs);
                return Response.json(allJobs);
            } catch (error) {
                console.error('Error fetching jobs:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (req.method === 'PUT' && url.pathname.startsWith('/api/v3/jobs/')) {
            const parts = url.pathname.split('/');
            const jobId = parseInt(parts[4] ?? '', 10);

            if (isNaN(jobId)) {
                return new Response(JSON.stringify({ error: 'Invalid Job ID.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            try {
                const { status } = await req.json();
                const validStatuses = ['pending_review', 'good_match', 'bad_match', 'applied', 'failed_analysis'];
                if (!validStatuses.includes(status)) {
                    return new Response(JSON.stringify({ error: `Invalid status provided. Must be one of: ${validStatuses.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                await db.update(discoveredJobs)
                    .set({ status: status, updatedAt: sql`CURRENT_TIMESTAMP` })
                    .where(eq(discoveredJobs.id, jobId));

                return Response.json({ message: `Job ${jobId} status updated to ${status}.` });

            } catch (error) {
                console.error(`Error updating job ${jobId} status:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }


        return new Response('Not Found', { status: 404 });
    },
});

console.log(`AgentHire Bun server running on http://localhost:${server.port}`);