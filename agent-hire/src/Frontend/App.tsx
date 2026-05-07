import React, { useEffect, useState } from 'react';
import AgentDashboard from './AgentDashboard';
import JobReviewPage from './JobReviewPage';
import LoginPage from './auth/loginPage';
import RegisterPage from './auth/SignupPage';
import { useAuth } from './context/AuthContext';

export default function App() {
    const [path, setPath] = useState(window.location.pathname);
    const auth = useAuth();

    useEffect(() => {
        const onPopState = () => setPath(window.location.pathname);
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    useEffect(() => {
        if (!auth.isHydrated) return;
        if (!auth.isAuthenticated && path !== '/login' && path !== '/register') {
            window.history.replaceState({}, '', '/login');
            setPath('/login');
        }
        if (auth.isAuthenticated && (path === '/login' || path === '/register')) {
            window.history.replaceState({}, '', '/');
            setPath('/');
        }
    }, [auth.isAuthenticated, auth.isHydrated, path]);

    const navigate = (to: string) => {
        if (to !== window.location.pathname) {
            window.history.pushState({}, '', to);
            setPath(to);
        }
    };

    if (!auth.isHydrated) {
        return null;
    }

    if (!auth.isAuthenticated) {
        if (path === '/register') {
            return <RegisterPage navigate={navigate} />;
        }

        return <LoginPage navigate={navigate} />;
    }

    if (path === '/review') {
        return <JobReviewPage navigate={navigate} />;
    }

    if (path === '/register') {
        return <RegisterPage navigate={navigate} />;
    }

    if (path === '/login') {
        return <LoginPage navigate={navigate} />;
    }

    return <AgentDashboard navigate={navigate} />;
}
