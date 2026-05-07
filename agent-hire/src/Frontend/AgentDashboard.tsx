// frontend/AgentDashboard.tsx (Conceptual)
import React, { useState } from 'react';
import JSON5 from 'json5';
import { useAuth } from './context/AuthContext';

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

    const handleTailorResume = async () => {
        setIsLoading(true);
        setError(null);
        setAgentResponse('');

        try {
            console.log('handleTailorResume clicked', { resumeLength: resume.length, jobDescriptionLength: jobDescription.length });
            const response = await fetch('/api/v2/tailor', {
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

            const response = await fetch('/api/v3/process-jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({ resume, jobs: normalizedJobs }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process jobs.');
            }

            const data = await response.json();
            setProcessedJobIds(data.newJobIds);
            setAgentResponse(`Successfully sent ${data.newJobIds.length} jobs for autonomous processing.`); // Update the main response display

        } catch (err: any) {
            setError(err.message || "Failed to process jobs.");
            console.error("Frontend error processing jobs:", err);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-blue-950">AgentHire: Resume Tailor (Phase 2)</h1>
                    <p className="text-sm text-gray-600">Signed in as {user?.email || 'your account'}.</p>
                </div>
                <button type="button" onClick={logout} className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300">Logout</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label htmlFor="resume" className="block text-lg font-medium text-gray-700 mb-2">Your Resume</label>
                    <textarea
                        id="resume"
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 h-64"
                        placeholder="Paste your resume here..."
                        value={resume}
                        onChange={(e) => setResume(e.target.value)}
                    ></textarea>
                </div>
                <div>
                    <label htmlFor="jobDesc" className="block text-lg font-medium text-gray-700 mb-2">Job Description</label>
                    <textarea
                        id="jobDesc"
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 h-64"
                        placeholder="Paste the job description here..."
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <button
                type="button"
                onClick={handleTailorResume}
                disabled={isLoading || !resume || !jobDescription}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
            >
                {isLoading ? 'Tailoring...' : 'Tailor My Resume (Phase 2)'}
            </button>

            <h2 className="text-2xl font-bold mt-10 mb-4">Phase 3: Autonomous Job Processing</h2>
            <div className="mb-6">
                <label htmlFor="jobSummaries" className="block text-lg font-medium text-gray-700 mb-2">Job Summaries (JSON Array)</label>
                <textarea
                    id="jobSummaries"
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 h-48"
                    placeholder='Paste a JSON array of job objects here: [{"title": "...", "company": "...", "summary": "..."}, ...]'
                    value={jobSummariesInput}
                    onChange={(e) => setJobSummariesInput(e.target.value)}
                ></textarea>
            </div>
            <button
                type="button"
                onClick={handleProcessMultipleJobs}
                disabled={isLoading || !jobSummariesInput}
                className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-300"
            >
                {isLoading ? 'Processing Jobs...' : 'Run Autonomous Job Agent (Phase 3)'}
            </button>

            {processedJobIds.length > 0 && (
                <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                    <p>Successfully initiated processing for {processedJobIds.length} jobs. Job IDs: {processedJobIds.join(', ')}</p>
                    <p>Visit the <button type="button" onClick={() => navigate('/review')} className="text-green-800 underline">Review Dashboard</button> to see the results!</p>
                </div>
            )}


            {error && (
                <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert">
                    <p className="font-bold">Error:</p>
                    <p>{error}</p>
                </div>
            )}

            {agentResponse && (
                <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-800">AI Assistant's Response:</h2>
                    <p className="text-gray-700 whitespace-pre-wrap">{agentResponse}</p>
                </div>
            )}
        </div>
    );
}