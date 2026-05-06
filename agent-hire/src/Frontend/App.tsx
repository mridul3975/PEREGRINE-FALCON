import React, { useEffect, useState } from 'react';
import AgentDashboard from './AgentDashboard';
import JobReviewPage from './JobReviewPage';

export default function App() {
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
        const onPopState = () => setPath(window.location.pathname);
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const navigate = (to: string) => {
        if (to !== window.location.pathname) {
            window.history.pushState({}, '', to);
            setPath(to);
        }
    };

    if (path === '/review') {
        return <JobReviewPage navigate={navigate} />;
    }

    return <AgentDashboard navigate={navigate} />;
}
