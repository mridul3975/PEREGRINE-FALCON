import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: { port: 5173 },
    root: '.', // adjust if you use a different public root
});