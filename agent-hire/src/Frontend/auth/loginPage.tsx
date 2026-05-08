// frontend/auth/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type LoginPageProps = {
    navigate: (to: string) => void;
};

export default function LoginPage({ navigate }: LoginPageProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Login failed.');
            }

            const data = await response.json();
            login(data.accessToken, data.refreshToken, data.userId, data.email, data.name);
            navigate('/');

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#06080d] text-[#e8ecf5]">
            <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[1.04fr_1fr]">
                <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(26,41,76,0.45)_0%,_rgba(7,10,18,0.98)_68%)]" />
                    <div className="absolute inset-0 opacity-30 [background:repeating-radial-gradient(circle_at_25%_55%,rgba(40,64,120,0.16),rgba(40,64,120,0.16)_2px,transparent_3px,transparent_22px)]" />
                    <div className="relative z-10 flex w-full flex-col justify-center px-20">
                        <div className="mb-10 flex items-center gap-3">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-white/50">
                                <span className="h-2.5 w-2.5 rotate-45 border border-white/70" />
                            </span>
                            <p className="tracking-[0.24em] text-[#dce4f4]">AGENTHIRE</p>
                        </div>
                        <h1 className="max-w-lg text-6xl font-semibold leading-[1.04] tracking-[-0.02em] text-white">
                            Algorithmic Talent Acquisition
                        </h1>
                        <p className="mt-8 max-w-xl text-2xl leading-relaxed text-[#d5deef]">
                            Deploy intelligence layers to automate technical evaluation. Our laboratory-grade engine parses
                            complex engineering signals to match hyper-specific agent roles with surgical precision.
                        </p>
                        <div className="mt-16 grid max-w-xl grid-cols-2 border-t border-white/10 pt-6 text-lg">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#b7c4de]">Architecture</p>
                                <p className="mt-2 text-[#eef3ff]">Neural matching protocols.</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#b7c4de]">Efficiency</p>
                                <p className="mt-2 text-[#eef3ff]">4ms latency on vetting.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
                    <div className="w-full max-w-[520px]">
                        <h2 className="text-5xl font-semibold leading-tight text-white">Identity Verification</h2>
                        <p className="mt-3 text-xl text-[#c0cbde]">Access the technical intelligence terminal.</p>

                        <form onSubmit={handleSubmit} className="mt-12 space-y-7">
                            <div>
                                <label htmlFor="email" className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-[#c0cde3]">
                                    Terminal Identifier (Email)
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    className="h-16 w-full border border-white/15 bg-[#0b0f16] px-5 text-lg text-white outline-none placeholder:text-[#5f6e85] focus:border-[#5f7dac]"
                                    placeholder="operator@agenthire.ai"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label htmlFor="password" className="block text-sm font-semibold uppercase tracking-[0.14em] text-[#c0cde3]">
                                        Access Key (Password)
                                    </label>
                                    <button type="button" className="text-sm font-semibold uppercase tracking-[0.1em] text-[#dce4f4]/90">Reset</button>
                                </div>
                                <input
                                    type="password"
                                    id="password"
                                    className="h-16 w-full border border-white/15 bg-[#0b0f16] px-5 text-lg text-white outline-none placeholder:text-[#5f6e85] focus:border-[#5f7dac]"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {error && <p className="text-sm text-[#ff7d7d]">{error}</p>}

                            <button
                                type="submit"
                                className="h-16 w-full bg-[#273142] text-lg font-semibold uppercase tracking-[0.08em] text-[#e9effc] transition hover:bg-[#314059] disabled:opacity-60"
                                disabled={isLoading}
                            >
                                {isLoading ? 'Initializing...' : 'Login'}
                            </button>

                            <div className="flex items-center gap-4 pt-2 text-sm uppercase tracking-[0.12em] text-[#94a3bf]">
                                <div className="h-px flex-1 bg-white/15" />
                                <span>or</span>
                                <div className="h-px flex-1 bg-white/15" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" className="h-12 border border-white/20 text-sm font-semibold uppercase tracking-[0.08em] text-[#e1e8f6]">
                                    SSO
                                </button>
                                <button type="button" 
                                onClick={() => {
    window.location.href = '/api/auth/google/login';
  }}
                                className="h-12 border border-white/20 text-sm font-semibold uppercase tracking-[0.08em] text-[#e1e8f6]">
                                      Sign in with Google

                                </button>
                            </div>

                            <div className="border-t border-white/15 pt-7 text-[15px] text-[#c0cbde]">
                                Don't have an account yet?{' '}
                                <button type="button" onClick={() => navigate('/register')} className="font-medium text-[#f6f9ff]">
                                    SignUp
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </div>
    );
}

