import { config } from 'dotenv';
import { analyzeJobMatch } from './phases/phase1_puppet';
import { runAgentWithTools } from './phases/phase2_agent';
import { orchestrateJobProcessing, type IncomingJobSummary } from './phases/phase3_orchestrator';
import { authMiddleware } from '../middleware/authmiddleware';
import { SignupUser, loginUser, refreshAccessToken, findOrCreateGoogleUser } from '../auth/auth';
config();
import { discoveredJobs } from '../db/schema';
import { db } from '../db/connection';
import { sql, eq } from 'drizzle-orm';

const server = Bun.serve({
    port: 3000,
    async fetch(req: Request) {
        const url = new URL(req.url);
        const defaultGoogleRedirectUri = `${url.origin}/api/auth/google/callback`;
        const googleRedirectUriFromEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
        const effectiveGoogleRedirectUri = googleRedirectUriFromEnv || defaultGoogleRedirectUri;

        if (!effectiveGoogleRedirectUri) {
            return new Response(JSON.stringify({ error: 'No Google redirect URI configured.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth')) {
            const authResponse = await authMiddleware(req);
            if (authResponse) {
                return authResponse;
            }
        }

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

        if (req.method === 'POST' && url.pathname === '/api/auth/register') {
            try {
                const userData = await req.json();
                const result = await SignupUser(userData);
                return Response.json(result);
            } catch (error) {
                console.error('Error processing /api/auth/register request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (req.method === 'POST' && url.pathname === '/api/auth/login') {
            try {
                const credentials = await req.json();
                const result = await loginUser(credentials);
                return Response.json(result);
            } catch (error) {
                console.error('Error processing /api/auth/login request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Invalid credentials';
                return new Response(JSON.stringify({ error: errorMessage }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (req.method === 'POST' && url.pathname === '/api/auth/refresh') {
            try {
                const { refreshToken } = await req.json();
                if (typeof refreshToken !== 'string' || !refreshToken) {
                    return new Response(JSON.stringify({ error: 'A valid refreshToken is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }
                const tokens = await refreshAccessToken(refreshToken);
                return Response.json(tokens);
            } catch (error) {
                console.error('Error processing /api/auth/refresh request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to refresh token.';
                return new Response(JSON.stringify({ error: errorMessage }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (req.method === 'POST' && url.pathname === '/api/v3/process-jobs') {
            try {
                const { jobs, resume } = await req.json();
                const currentUser = (req as any).user;

                if (!currentUser || typeof currentUser.userId !== 'number') {
                    return new Response(JSON.stringify({ error: 'Unauthorized user.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
                }

                if (!Array.isArray(jobs) || jobs.length === 0 || !resume || typeof resume !== 'string') {
                    return new Response(JSON.stringify({ error: 'Invalid input: "jobs" array and "resume" string are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const result = await orchestrateJobProcessing(jobs as IncomingJobSummary[], resume, currentUser.userId);
                return Response.json({ message: `Successfully initiated processing for ${result.processedCount} jobs.`, newJobIds: result.newJobIds });

            } catch (error) {
                console.error('Error processing /api/v3/process-jobs request:', error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage, details: 'Failed to orchestrate job processing.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }


        if (req.method === 'GET' && url.pathname === '/api/v3/jobs') {
            try {
                const currentUser = (req as any).user;
                if (!currentUser || typeof currentUser.userId !== 'number') {
                    return new Response(JSON.stringify({ error: 'Unauthorized user.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
                }

                const allJobs = await db.select().from(discoveredJobs).where(eq(discoveredJobs.userId, currentUser.userId));
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
            const currentUser = (req as any).user;

            if (isNaN(jobId)) {
                return new Response(JSON.stringify({ error: 'Invalid Job ID.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            if (!currentUser || typeof currentUser.userId !== 'number') {
                return new Response(JSON.stringify({ error: 'Unauthorized user.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            }

            try {
                const { status } = await req.json();
                const validStatuses = ['pending_review', 'good_match', 'bad_match', 'applied', 'failed_analysis'];
                if (!validStatuses.includes(status)) {
                    return new Response(JSON.stringify({ error: `Invalid status provided. Must be one of: ${validStatuses.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
                }

                const updateResult = await db.update(discoveredJobs)
                    .set({ status: status, updatedAt: sql`CURRENT_TIMESTAMP` })
                    .where(eq(discoveredJobs.id, jobId), eq(discoveredJobs.userId, currentUser.userId));

                if (updateResult.rowsAffected === 0) {
                    return new Response(JSON.stringify({ error: 'Job not found or not owned by the current user.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
                }

                return Response.json({ message: `Job ${jobId} status updated to ${status}.` });

            } catch (error) {
                console.error(`Error updating job ${jobId} status:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (req.method === 'GET' && url.pathname === '/api/auth/google/login') {
            const params = new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                redirect_uri: effectiveGoogleRedirectUri,
                response_type: 'code',
                scope: 'openid email profile',
                access_type: 'offline',
                prompt: 'consent',
            });
            return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
        }

        if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
            try {
                const code = url.searchParams.get('code');
                if (!code) return new Response('Missing code', { status: 400 });

                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: process.env.GOOGLE_CLIENT_ID!,
                        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                        redirect_uri: effectiveGoogleRedirectUri,
                        grant_type: 'authorization_code',
                    }),
                });

                const tokenJson = await tokenRes.json();
                if (!tokenRes.ok || !tokenJson.access_token) {
                    console.error('Google token exchange failed:', { tokenJson, redirect_uri: effectiveGoogleRedirectUri });
                    return new Response(JSON.stringify({ error: 'Google token exchange failed.', details: tokenJson, redirect_uri: effectiveGoogleRedirectUri }), { status: 502, headers: { 'Content-Type': 'application/json' } });
                }

                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
                });
                const profile = await userInfoRes.json();

                if (!profile?.email || !profile?.sub) {
                    console.error('Google profile fetch failed:', profile);
                    return new Response(JSON.stringify({ error: 'Unable to retrieve Google profile information.' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
                }

                const result = await findOrCreateGoogleUser({
                    email: profile.email,
                    name: profile.name,
                    sub: profile.sub,
                });

                const params = new URLSearchParams({
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    userId: result.userId.toString(),
                    email: result.email,
                    name: result.name || '',
                });

                return Response.redirect(`http://localhost:5173/google-callback?${params.toString()}`, 302);
            } catch (error) {
                console.error('Google callback error:', error);
                const message = error instanceof Error ? error.message : 'Internal Server Error';
                return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }

        return new Response('Not Found', { status: 404 });
    },
});

console.log(`AgentHire Bun server running on http://localhost:${server.port}`);