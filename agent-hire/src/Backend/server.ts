import { analyzeJobMatch } from "./phases/phase1_puppet";

const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);

        // Handle CORS for your frontend
        if (req.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (url.pathname === "/api/v1/analyze" && req.method === "POST") {
            try {
                const { resume, jobDesc } = await req.json();

                // Execute the AI logic
                const analysis = await analyzeJobMatch(resume, jobDesc);

                // RETURN the response to the user
                return Response.json(analysis, {
                    headers: { "Access-Control-Allow-Origin": "*" }
                });
            } catch (err: any) {
                return Response.json({ error: err.message }, { status: 500 });
            }
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`AgentHire running at http://localhost:${server.port}`);