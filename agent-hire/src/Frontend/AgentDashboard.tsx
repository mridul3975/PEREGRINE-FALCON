import React, { useState } from 'react';

// Types for our two different phases
interface Phase1Result {
    matchScore: number;
    missingKeywords: string[];
    executiveSummary: string;
}

interface Phase2Result {
    answer: string;
    steps: any[];
}

export default function AgentDashboard() {
    const [resume, setResume] = useState('');
    const [jobDesc, setJobDesc] = useState('');
    const [mode, setMode] = useState<'v1' | 'v2'>('v1');
    const [result, setResult] = useState<Phase1Result | Phase2Result | null>(null);
    const [loading, setLoading] = useState(false);

    const handleRun = async () => {
        setLoading(true);
        setResult(null);

        const endpoint = mode === 'v1' ? '/api/v1/analyze' : '/api/v2/tailor';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume, jobDesc }),
            });
            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error("Agent failed:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto font-sans bg-white min-h-screen">
            <header className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-gray-900 italic">AgentHire <span className="text-blue-600">.ai</span></h1>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('v1')}
                        className={`px-4 py-2 rounded-md transition ${mode === 'v1' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        Phase 1: Basic
                    </button>
                    <button
                        onClick={() => setMode('v2')}
                        className={`px-4 py-2 rounded-md transition ${mode === 'v2' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                    >
                        Phase 2: Agentic
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col">
                    <label className="font-bold mb-2 text-gray-700">Your Resume</label>
                    <textarea
                        placeholder="Paste your experience here..."
                        className="h-80 p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        value={resume}
                        onChange={(e) => setResume(e.target.value)}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="font-bold mb-2 text-gray-700">Job Description</label>
                    <textarea
                        placeholder="Paste the job requirements here..."
                        className="h-80 p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        value={jobDesc}
                        onChange={(e) => setJobDesc(e.target.value)}
                    />
                </div>
            </div>

            <button
                onClick={handleRun}
                disabled={loading || !resume || !jobDesc}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-all shadow-lg"
            >
                {loading ? 'Agent is thinking...' : mode === 'v1' ? 'Calculate Match Score' : 'Run Tailoring Agent'}
            </button>

            {/* RESULT SECTION */}
            {result && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {mode === 'v1' ? (
                        <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold">Analysis Results</h2>
                                <span className="text-4xl font-black text-blue-600">{(result as Phase1Result).matchScore}%</span>
                            </div>
                            <p className="text-gray-700 mb-4">{(result as Phase1Result).executiveSummary}</p>
                            <h3 className="font-bold mb-2">Missing Keywords:</h3>
                            <div className="flex flex-wrap gap-2">
                                {(result as Phase1Result).missingKeywords.map(k => (
                                    <span key={k} className="bg-white border border-blue-200 px-3 py-1 rounded-full text-sm font-medium text-blue-700">
                                        {k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-purple-50 border border-purple-100 rounded-2xl">
                            <h2 className="text-xl font-bold mb-4 text-purple-900 italic">Agent Response</h2>
                            <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">
                                {(result as Phase2Result).answer}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}