import { analyzeJobMatch } from "./phases/phase1_puppet";

const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);

        // Endpoint for our frontend to call
        if (url.pathname === "/api/analyze" && req.method === "POST") {
            const { resume, jobDesc } = await req.json() as { resume: string; jobDesc: string };
            const analysis = await analyzeJobMatch(resume, jobDesc);
            return new Response(JSON.stringify(analysis), {
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);