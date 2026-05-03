import React, { useState } from 'react';

export default function AgentDashboard() {
    const [resume, setResume] = useState('');
    const [jobDesc, setJobDesc] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        setLoading(true);
        // This will connect to your Bun API route in Step 5
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: JSON.stringify({ resume, jobDesc }),
            });
            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error('Error analyzing job match:', error);
        }
        setLoading(false);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto font-sans">
            <h1 className="text-2xl font-bold mb-6">AgentHire: Phase 1 (The Puppet)</h1>

            <div className="grid grid-cols-2 gap-4">
                <textarea
                    placeholder="Paste Resume here..."
                    className="h-64 p-4 border rounded"
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResume(e.target.value)}
                />
                <textarea
                    placeholder="Paste Job Description here..."
                    className="h-64 p-4 border rounded"
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobDesc(e.target.value)}
                />
            </div>

            <button
                onClick={handleAnalyze}
                disabled={loading}
                className="mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
                {loading ? 'Analyzing...' : 'Calculate Match Score'}
            </button>

            {result && (
                <div className="mt-8 p-6 bg-gray-50 border rounded whitespace-pre-wrap">
                    <h2 className="font-bold mb-2">AI Analysis:</h2>
                    {result}
                </div>
            )}
        </div>
    );
}