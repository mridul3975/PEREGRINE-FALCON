import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';

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

type JobReviewPageProps = {
    navigate: (to: string) => void;
};

export default function JobReviewPage({ navigate }: JobReviewPageProps) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { getAuthHeaders } = useAuth();

    const fetchJobs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/v3/jobs', {
                headers: {
                    ...getAuthHeaders(),
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Failed to fetch jobs.');
            }
            const data: Job[] = await response.json();
            setJobs(data);
        } catch (err: any) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const updateJobStatus = async (id: number, newStatus: Job['status']) => {
        try {
            const response = await fetch(`/api/v3/jobs/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Failed to update job status.');
            }
            fetchJobs();
        } catch (err: any) {
            setError(err.message);
            console.error(err);
        }
    };

    if (isLoading) return <div className="text-center p-8">Loading jobs...</div>;
    if (error) return <div className="text-center p-8 text-red-600">Error: {error}</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <button type="button" onClick={() => navigate('/')} className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Back to Dashboard</button>
            <h1 className="text-3xl font-bold mb-6">AgentHire: Job Review Dashboard</h1>

            {jobs.length === 0 && <p className="text-gray-600">No jobs processed yet. Go to the main dashboard to input jobs!</p>}

            {jobs.map((job) => (
                <div key={job.id} className="bg-white shadow-md rounded-lg p-6 mb-4 border-l-4 border-blue-500">
                    <h2 className="text-xl font-semibold mb-2">{job.title} at {job.company}</h2>
                    <p className="text-sm text-gray-500 mb-2">Status: <span className={`font-medium ${job.status === 'good_match' ? 'text-green-600' : job.status === 'bad_match' ? 'text-red-600' : 'text-yellow-600'}`}>{job.status.replace(/_/g, ' ')}</span></p>
                    <p className="text-gray-700 mb-3 line-clamp-3">{job.summary}</p>

                    {job.aiAnalysis && <p className="text-gray-600 italic mb-2">AI Analysis: {job.aiAnalysis}</p>}
                    {job.tailoredResumeSection && <p className="text-gray-600 italic mb-2">Tailored Section Preview: {job.tailoredResumeSection}</p>}
                    {job.applicationNote && <p className="text-gray-600 italic mb-2">Application Note: {job.applicationNote}</p>}

                    <div className="mt-4 space-x-2">
                        {job.status === 'pending_review' && (
                            <>
                                <button onClick={() => updateJobStatus(job.id, 'good_match')} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">Mark Good Match</button>
                                <button onClick={() => updateJobStatus(job.id, 'bad_match')} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Mark Bad Match</button>
                            </>
                        )}
                        {job.status === 'good_match' && (
                            <button onClick={() => updateJobStatus(job.id, 'applied')} className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">Mark Applied</button>
                        )}
                        {/* Add more buttons for 'view details', 'edit' etc. */}
                    </div>
                </div>
            ))}
        </div>
    );
}