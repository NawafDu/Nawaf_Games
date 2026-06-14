import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Base path for GitHub Pages deployment.
// Set VITE_BASE_PATH in your build environment to "/<repo-name>/" when deploying
// to GitHub Pages (e.g. "/shadow-circuit/"). Defaults to "/" for local dev
// and Firebase Hosting.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: "/"
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
