import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root:'frontend', plugins: [react()], publicDir:'public', build:{outDir:'../dist',emptyOutDir:true}, server: { host: '127.0.0.1', port: 5175, proxy: { '/api': 'http://localhost:5000' } } });
