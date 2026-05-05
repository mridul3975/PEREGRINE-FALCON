import { config } from 'dotenv';
import { analyzeJobMatch } from './phases/phase1_puppet';
import { runAgentWithTools } from './phases/phase2_agent';
config();

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

                return Response.json({
                    text: agentResult.text,
                    toolResults: agentResult.toolResults,
                    finishReason: agentResult.finishReason,
                    usage: agentResult.usage
                });
            } catch (error) {
                console.error('Error processing /api/v2/tailor request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage, details: 'Failed to run tailoring agent.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return new Response('Not Found', { status: 404 });
    },
});

console.log(`AgentHire Bun server running on http://localhost:${server.port}`);