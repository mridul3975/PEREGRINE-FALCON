// frontend/AgentDashboard.tsx (Conceptual)
import React, { useEffect, useState } from 'react';
import JSON5 from 'json5';
import { useAuth } from './context/AuthContext';
import { API_BASE_URL, buildApiUrl } from './utils/api';

type AgentDashboardProps = {
    navigate: (to: string) => void;
};

export default function AgentDashboard({ navigate }: AgentDashboardProps) {
    const { getAuthHeaders, logout, user } = useAuth();
    const [resume, setResume] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [agentResponse, setAgentResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [jobSummariesInput, setJobSummariesInput] = useState('');
    const [processedJobIds, setProcessedJobIds] = useState<number[]>([]);

    type Job = {
        id: number;
        title: string;
        company: string;
        summary: string;
        status: 'pending_review' | 'good_match' | 'bad_match' | 'applied' | 'failed_analysis';
        aiAnalysis?: string;
        tailoredResumeSection?: string;
        applicationNote?: string;
        createdAt: string;
        updatedAt: string;
    };

    const [jobs, setJobs] = useState<Job[]>([]);

    type ParsedJob = {
        title?: string;
        company?: string;
        summary?: string;
        [key: string]: string | undefined;
    };

    const parseJobBlock = (block: string): ParsedJob => {
        const lines = block
            .split(/\r?\n|;|\|/)
            .map((line) => line.trim())
            .filter(Boolean);

        const result: ParsedJob = {};

        const normalizeKey = (key: string) =>
            key
                .trim()
                .replace(/^['"]+|['"]+$/g, '')
                .toLowerCase()
                .replace(/\s+/g, '_');

        const normalizeValue = (value: unknown) =>
            String(value)
                .trim()
                .replace(/^['"]+|['"]+$/g, '')
                .replace(/,$/, '');

        for (const line of lines) {
            const trimmedLine = line.replace(/,$/, '').trim();

            if (trimmedLine.includes(':')) {
                try {
                    const parsed = JSON5.parse(`{${trimmedLine}}`);
                    if (parsed && typeof parsed === 'object') {
                        for (const [rawKey, rawValue] of Object.entries(parsed)) {
                            const key = normalizeKey(rawKey);
                            result[key] = normalizeValue(rawValue);
                        }
                        continue;
                    }
                } catch {
                    // fallback to non-JSON parsing
                }
            }

            const kvMatch = trimmedLine.match(/^\s*["']?([A-Za-z0-9 _-]+?)["']?\s*(?:[:=]|\-\s)\s*(.+)$/);
            if (kvMatch !== null && kvMatch[1] && kvMatch[2]) {
                const key = normalizeKey(kvMatch[1]);
                result[key] = normalizeValue(kvMatch[2]);
                continue;
            }

            const lower = trimmedLine.toLowerCase();
            if (lower.startsWith('title')) {
                result.title = trimmedLine.split(/[:=]/).slice(1).join(':').trim();
                continue;
            }
            if (lower.startsWith('company')) {
                result.company = trimmedLine.split(/[:=]/).slice(1).join(':').trim();
                continue;
            }
            if (lower.startsWith('summary') || lower.startsWith('description') || lower.startsWith('jobdescription')) {
                result.summary = trimmedLine.split(/[:=]/).slice(1).join(':').trim();
                continue;
            }
        }

        if (!result.title || !result.company || !result.summary) {
            if (!result.title && lines.length > 0) result.title = lines[0];
            if (!result.company && lines.length > 1) result.company = lines[1];
            if (!result.summary && lines.length > 2) result.summary = lines.slice(2).join(' ');
            if (!result.summary && lines.length === 2) result.summary = lines[1];
            if (!result.company && lines.length === 1) result.company = 'Unknown Company';
        }

        return result;
    };

    const parseJobSummariesInput = (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            if (typeof parsed === 'object' && parsed !== null) return [parsed];
        } catch (jsonError) {
            try {
                const parsed = JSON5.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
                if (typeof parsed === 'object' && parsed !== null) return [parsed];
            } catch {
                const blocks = trimmed.split(/\n{2,}|---|\*\*/).map((block) => block.trim()).filter(Boolean);
                const parsed = blocks.map(parseJobBlock).filter((job) => Object.keys(job).length > 0);
                if (parsed.length > 0) return parsed;
            }
        }

        throw new Error('Unable to parse job summaries. Provide a list of job objects or simple job blocks.');
    };

    const fetchDashboardJobs = async () => {
        try {
            const response = await fetch(buildApiUrl('/api/v3/jobs'), {
                headers: {
                    ...getAuthHeaders(),
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load dashboard data.');
            }
            const data: Job[] = await response.json();
            setJobs(data);
        } catch (err: any) {
            console.error('Failed to fetch dashboard jobs:', err);
        }
    };

    useEffect(() => {
        fetchDashboardJobs();
    }, []);

    const handleTailorResume = async () => {
        setIsLoading(true);
        setError(null);
        setAgentResponse('');

        try {
            console.log('handleTailorResume clicked', { resumeLength: resume.length, jobDescriptionLength: jobDescription.length });
            const response = await fetch(buildApiUrl('/api/v2/tailor'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({ resume, jobDescription }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Something went wrong on the server.');
            }

            // The backend returns { fullConversation: [...], finalMessage: "..." }
            const data = await response.json();
            console.log('Tailor response payload:', data);
            const rawAgentText =
                typeof data === 'string'
                    ? data
                    : data.optimizedContent || data.finalMessage || data.text || data.output || data.message || JSON.stringify(data, null, 2);
            setAgentResponse(String(rawAgentText));

        } catch (err: any) {
            console.error("Frontend error:", err);
            setError(err.message || "Failed to tailor resume.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleProcessMultipleJobs = async () => {
        setIsLoading(true);
        setError(null);
        setProcessedJobIds([]);

        try {
            console.log('handleProcessMultipleJobs clicked', { resumeLength: resume.length, jobSummariesInputLength: jobSummariesInput.length });

            const parsedJobs = parseJobSummariesInput(jobSummariesInput);
            if (!Array.isArray(parsedJobs) || parsedJobs.length === 0) {
                throw new Error("Invalid job summaries format. Expected a non-empty JSON array of jobs.");
            }

            if (!resume) {
                throw new Error('Please enter your resume before processing jobs.');
            }

            const normalizedJobs = parsedJobs.map((job: any, index: number) => {
                if (typeof job !== 'object' || job === null) {
                    throw new Error(`Invalid job at index ${index}. Expected an object.`);
                }

                const title = job.title || job.jobTitle || job.position;
                const company = job.company || job.employer;
                const summary = job.summary || job.description || job.jobDescription;

                if (!title || !company || !summary) {
                    throw new Error(`Invalid job at index ${index}. Each job must include title, company, and summary/description.`);
                }

                return { title, company, summary };
            });

            const response = await fetch(buildApiUrl('/api/v3/process-jobs'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({ resume, jobs: normalizedJobs }),
            });

            const rawResponse = await response.text();
            if (!response.ok) {
                console.error('process-jobs error response:', response.status, rawResponse);
                let errorText = 'Failed to process jobs.';
                try {
                    const errorData = JSON.parse(rawResponse);
                    errorText = errorData?.error || errorText;
                } catch {
                    if (rawResponse) {
                        errorText = rawResponse;
                    }
                }
                throw new Error(errorText);
            }

            let data;
            try {
                data = JSON.parse(rawResponse);
            } catch {
                console.error('process-jobs invalid JSON:', rawResponse);
                throw new Error(`Received invalid JSON from the server. Check the configured API base URL: ${API_BASE_URL}`);
            }

            setProcessedJobIds(data.newJobIds);
            setAgentResponse(`Successfully sent ${data.newJobIds.length} jobs for autonomous processing.`); // Update the main response display
            await fetchDashboardJobs();

        } catch (err: any) {
            let message = err.message || 'Failed to process jobs.';
            if (message.includes('Failed to fetch') || message.includes('ECONNREFUSED')) {
                message = 'Could not reach the backend on http://localhost:3000. Start the Bun server and retry.';
            }
            setError(message);
            console.error('Frontend error processing jobs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const pendingCount = jobs.filter((job) => job.status === 'pending_review').length;
    const appliedCount = jobs.filter((job) => job.status === 'applied').length;

    const eventLog = [...jobs]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4)
        .map((job) => {
            const time = new Date(job.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let message = `Queued ${job.title} for review.`;
            if (job.status === 'good_match') message = `Good match confirmed: ${job.title}.`;
            if (job.status === 'bad_match') message = `Bad match flagged: ${job.title}.`;
            if (job.status === 'applied') message = `Application submitted for ${job.title}.`;
            if (job.status === 'failed_analysis') message = `Analysis failed for ${job.title}.`;
            return { time, message };
        });

    return (
        <div className="min-h-screen bg-[#06080d] px-6 py-8 text-[#e8ecf5]">
            <div className="mx-auto max-w-7xl">
                <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-[#9fb0cd]"></p>
                        <h1 className="mt-2 text-4xl uppercase tracking-[0.3em] text-[#9fb0cd]">AgentHire</h1>
                        <p className="mt-2 text-sm text-[#c0cbde]">Analyze resumes and job descriptions, then preview autonomous application processing.</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-[#0b0f16] px-5 py-4 shadow-xl shadow-black/30">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-[#9fb0cd]">Signed in as</p>
                            <p className="font-medium text-white">{user?.email || 'Your account'}</p>
                        </div>
                        <button type="button" onClick={logout} className="rounded-full bg-[#273142] px-4 py-2 text-sm text-[#e8ecf5] transition hover:bg-[#314059]">Sign Out</button>
                    </div>
                </header>

                <div className="grid gap-6 xl:grid-cols-[1.8fr_0.9fr]">
                    <section className="rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/20">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>

                                <h2 className="mt-3 text-2xl uppercase tracking-[0.25em] text-white">JOB-PROFILE ALIGNMENT</h2>
                            </div>
                            <div className="rounded-full bg-[#273142] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#d8e1f3]">Tailoring Mode</div>
                        </div>

                        <div className="mt-6 grid gap-4 xl:grid-cols-2">
                            <div className="rounded-3xl border border-white/10 bg-[#080c13] p-4">
                                <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[#9fb0cd]">Your Resume</p>
                                <textarea
                                    id="resume"
                                    className="h-64 w-full resize-none rounded-2xl border border-white/15 bg-[#0b0f16] p-4 text-sm text-[#e8ecf5] outline-none focus:border-[#5f7dac] focus:ring-2 focus:ring-[#5f7dac]/25"
                                    placeholder="Paste resume text here..."
                                    value={resume}
                                    onChange={(e) => setResume(e.target.value)}
                                />
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-[#080c13] p-4">
                                <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[#9fb0cd]">Job Description</p>
                                <textarea
                                    id="jobDesc"
                                    className="h-64 w-full resize-none rounded-2xl border border-white/15 bg-[#0b0f16] p-4 text-sm text-[#e8ecf5] outline-none focus:border-[#5f7dac] focus:ring-2 focus:ring-[#5f7dac]/25"
                                    placeholder="Paste job description here..."
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <button
                                type="button"
                                onClick={handleTailorResume}
                                disabled={isLoading || !resume || !jobDescription}
                                className="flex-1 rounded-2xl bg-[#273142] px-6 py-3 text-sm font-semibold text-[#e8ecf5] transition hover:bg-[#314059] disabled:cursor-not-allowed disabled:bg-[#1c2331]"
                            >
                                {isLoading ? 'Running Alignment...' : 'Run Alignment Scan'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setResume('');
                                    setJobDescription('');
                                    setAgentResponse('');
                                    setError(null);
                                }}
                                className="rounded-2xl border border-white/20 bg-[#080c13] px-6 py-3 text-sm text-[#c0cbde] transition hover:border-white/35 hover:text-white"
                            >
                                Clear Fields
                            </button>
                        </div>

                        {agentResponse && (
                            <div className="mt-6 rounded-3xl border border-white/10 bg-[#0b0f16] p-5 text-sm text-[#d7e0f0]">
                                <p className="font-semibold text-slate-100">Alignment Result</p>
                                <p className="mt-3 whitespace-pre-wrap">{agentResponse}</p>
                            </div>
                        )}
                        {error && (
                            <div className="mt-6 rounded-3xl border border-rose-500/40 bg-rose-950/40 p-5 text-sm text-rose-200">
                                <p className="font-semibold text-rose-100">Error</p>
                                <p className="mt-2">{error}</p>
                            </div>
                        )}
                    </section>

                    <aside className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/20">
                            <div className="mb-4 flex items-center justify-between">
                                <p className="text-xs uppercase tracking-[0.24em] text-[#9fb0cd]">Job Status</p>
                                <span className="rounded-full bg-[#273142] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#d8e1f3]">Active</span>
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-3xl border border-white/10 bg-[#080c13] p-4">
                                    <p className="text-sm text-[#c0cbde]">Pending Review</p>
                                    <p className="mt-2 text-3xl font-semibold text-white">{pendingCount}</p>
                                </div>
                                <div className="rounded-3xl border border-white/10 bg-[#080c13] p-4">
                                    <p className="text-sm text-[#c0cbde]">Applied</p>
                                    <p className="mt-2 text-3xl font-semibold text-white">{appliedCount}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/20">
                            <p className="text-xs uppercase tracking-[0.24em] text-[#9fb0cd]">Live Score</p>
                            <div className="mt-4 rounded-3xl bg-[#080c13] p-5">
                                <p className="text-sm text-[#c0cbde]">Matching Accuracy</p>
                                <p className="mt-3 text-4xl font-semibold text-white">92.4%</p>
                                <div className="mt-5 flex items-end gap-2">
                                    <div className="h-16 w-6 rounded-full bg-[#273142]" />
                                    <div className="h-24 w-6 rounded-full bg-[#5f7dac]" />
                                    <div className="h-20 w-6 rounded-full bg-[#273142]" />
                                    <div className="h-28 w-6 rounded-full bg-[#738fb9]" />
                                    <div className="h-14 w-6 rounded-full bg-[#273142]" />
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1.3fr]">
                    <section className="rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/20">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="mt-2 uppercase tracking-[0.25em] text-2xl text-white">JOB SUMMARIES</h3>
                            </div>
                            <span className="rounded-full bg-[#273142] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#d8e1f3]">Processing Mode: High</span>
                        </div>

                        <div className="mt-5 rounded-3xl border border-white/10 bg-[#080c13] p-4">
                            <textarea
                                id="jobSummaries"
                                className="h-56 w-full resize-none rounded-3xl border border-white/15 bg-[#0b0f16] p-4 text-sm text-[#e8ecf5] outline-none focus:border-[#5f7dac] focus:ring-2 focus:ring-[#5f7dac]/25"
                                placeholder='Paste job summaries here: [{"title": "...", "company": "...", "summary": "..."}, ...]'
                                value={jobSummariesInput}
                                onChange={(e) => setJobSummariesInput(e.target.value)}
                            />
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <button
                                type="button"
                                onClick={handleProcessMultipleJobs}
                                disabled={isLoading || !jobSummariesInput}
                                className="flex-1 rounded-2xl bg-[#273142] px-6 py-3 text-sm font-semibold text-[#e8ecf5] transition hover:bg-[#314059] disabled:cursor-not-allowed disabled:bg-[#1c2331]"
                            >
                                {isLoading ? 'Processing Jobs...' : 'Run Autonomous Job Agent'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/review')}
                                className="rounded-2xl border border-white/20 bg-[#080c13] px-6 py-3 text-sm text-[#c0cbde] transition hover:border-white/35 hover:text-white"
                            >
                                Review Dashboard
                            </button>
                        </div>

                    </section>

                    <aside className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/20">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-[0.24em] text-[#9fb0cd]">Event Log</p>
                                <span className="text-xs text-[#c0cbde]">Status: Stable</span>
                            </div>
                            <div className="mt-5 space-y-4 text-sm text-[#d7e0f0]">
                                {eventLog.length > 0 ? (
                                    eventLog.map((entry, index) => (
                                        <div key={index} className="rounded-3xl bg-[#080c13] p-4">
                                            <p className="text-[#9fb0cd]">{entry.time}</p>
                                            <p className="mt-1 text-white">{entry.message}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-3xl bg-[#080c13] p-4">
                                        <p className="text-[#9fb0cd]">--:--</p>
                                        <p className="mt-1 text-white">No recent activity yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
