// frontend/AgentDashboard.tsx (Conceptual)
import React, { useState } from 'react';

export default function AgentDashboard() {
    const [resume, setResume] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [agentResponse, setAgentResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [jobSummariesInput, setJobSummariesInput] = useState('');
    const [processedJobIds, setProcessedJobIds] = useState<number[]>([]);

    const handleTailorResume = async () => {
        setIsLoading(true);
        setError(null);
        setAgentResponse('');

        try {
            const response = await fetch('/api/v2/tailor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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

            const parsedJobs = JSON.parse(jobSummariesInput);
            if (!Array.isArray(parsedJobs) || parsedJobs.some(job => !job.title || !job.company || !job.summary)) {
                throw new Error("Invalid job summaries format. Expected an array of objects with title, company, summary.");
            }

            const response = await fetch('/api/v3/process-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume: resume, jobs: parsedJobs }),
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
            <h1 className="text-3xl font-bold mb-6 text-blue-950">AgentHire: Resume Tailor (Phase 2)</h1>

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
                onClick={handleProcessMultipleJobs}
                disabled={isLoading || !resume || !jobSummariesInput}
                className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-300"
            >
                {isLoading ? 'Processing Jobs...' : 'Run Autonomous Job Agent (Phase 3)'}
            </button>

            {processedJobIds.length > 0 && (
                <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                    <p>Successfully initiated processing for {processedJobIds.length} jobs. Job IDs: {processedJobIds.join(', ')}</p>
                    <p>Visit the <a href="/review" className="text-green-800 underline">Review Dashboard</a> to see the results!</p>
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