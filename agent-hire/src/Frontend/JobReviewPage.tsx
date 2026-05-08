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

    if (isLoading) return <div className="text-center p-8 text-slate-200">Loading jobs...</div>;
    if (error) return <div className="text-center p-8 text-rose-400">Error: {error}</div>;

    return (
        <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
            <div className="mx-auto max-w-6xl">
                <button type="button" onClick={() => navigate('/')} className="mb-6 inline-flex items-center rounded-2xl border border-white/10 bg-[#0b0f16] px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-slate-900">
                    Back to Dashboard
                </button>
                <div className="mb-8 rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/20">
                    <h1 className="text-3xl font-semibold text-white">AgentHire: Job Review Dashboard</h1>
                    <p className="mt-2 text-sm text-slate-400">Review your scoped job matches and update statuses for your active jobs.</p>
                </div>

                {jobs.length === 0 && <p className="text-slate-400">No jobs processed yet. Go to the main dashboard to input jobs!</p>}

                {jobs.map((job) => (
                    <div key={job.id} className="mb-5 rounded-3xl border border-white/10 bg-[#0b0f16] p-6 shadow-xl shadow-black/10">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="text-2xl font-semibold text-white">{job.title}</h2>
                                <p className="mt-1 text-sm text-slate-400">{job.company}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-sm font-medium ${job.status === 'good_match' ? 'bg-emerald-500/10 text-emerald-300' : job.status === 'bad_match' ? 'bg-rose-500/10 text-rose-300' : job.status === 'applied' ? 'bg-violet-500/10 text-violet-300' : 'bg-amber-500/10 text-amber-300'}`}>{job.status.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="mt-4 text-slate-300">{job.summary}</p>

                        {job.aiAnalysis && <p className="mt-4 text-slate-400 italic">AI Analysis: {job.aiAnalysis}</p>}
                        {job.tailoredResumeSection && <p className="mt-3 text-slate-400 italic">Tailored Section Preview: {job.tailoredResumeSection}</p>}
                        {job.applicationNote && <p className="mt-3 text-slate-400 italic">Application Note: {job.applicationNote}</p>}

                        <div className="mt-6 flex flex-wrap gap-3">
                            {job.status === 'pending_review' && (
                                <>
                                    <button onClick={() => updateJobStatus(job.id, 'good_match')} className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">Mark Good Match</button>
                                    <button onClick={() => updateJobStatus(job.id, 'bad_match')} className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400">Mark Bad Match</button>
                                </>
                            )}
                            {job.status === 'good_match' && (
                                <button onClick={() => updateJobStatus(job.id, 'applied')} className="rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-400">Mark Applied</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}