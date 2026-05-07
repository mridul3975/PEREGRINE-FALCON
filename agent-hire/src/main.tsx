import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './Frontend/App';
import { AuthProvider } from './Frontend/context/AuthContext';

createRoot(document.getElementById('root')!).render(
    <AuthProvider>
        <App />
    </AuthProvider>
);