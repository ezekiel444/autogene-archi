import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Build into ../public so the Express server (src/index.ts serves public/)
    // and the serverless deploys all use one consistent output directory.
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
