import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function GoogleCallbackPage({ navigate }: { navigate: (to: string) => void }) {
    const { login } = useAuth();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('accessToken') || urlParams.get('access_token');
        const refreshToken = urlParams.get('refreshToken') || urlParams.get('refresh_token');
        const userId = Number(urlParams.get('userId') || urlParams.get('user_id') || '0');
        const email = urlParams.get('email');
        const name = urlParams.get('name');

        if (accessToken && refreshToken && email && userId) {
            login(accessToken, refreshToken, userId, email, name);
            navigate('/');
        } else {
            navigate('/login');
        }
    }, [login, navigate]);

 return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-[#0b0f16] p-10 shadow-xl">
        <p className="text-center text-lg">Signing you in with Google...</p>
      </div>
    </div>
  );
}