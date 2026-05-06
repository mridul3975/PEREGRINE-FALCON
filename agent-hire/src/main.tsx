import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentDashboard from './Frontend/AgentDashboard';

createRoot(document.getElementById('root')!).render(<AgentDashboard />);