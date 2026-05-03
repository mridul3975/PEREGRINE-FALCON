import { analyzeJobMatch } from "./phases/phase1_puppet";
import { runAgentWithTools } from "./phases/phase2_agent";

const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);

        // --- Phase 1 Route ---
        if (url.pathname === "/api/v1/analyze" && req.method === "POST") {
            const { resume, jobDesc } = await req.json();
            const analysis = await analyzeJobMatch(resume, jobDesc);
            return Response.json(analysis);
        }

        // --- Phase 2 Route ---
        if (url.pathname === "/api/v2/tailor" && req.method === "POST") {
            const { resume, jobDesc } = await req.json();
            const result = await runAgentWithTools(resume, jobDesc);

            return Response.json({
                answer: result.text,
                steps: result.steps // Helpful for debugging tool usage
            });
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`🚀 AgentHire running at http://localhost:3000`);

