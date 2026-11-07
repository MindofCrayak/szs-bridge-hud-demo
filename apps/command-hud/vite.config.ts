import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { handleAlfredRequest, handleAlfredStatus } from './server/alfredProxy.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const repoEnvFile = path.join(repoRoot, '.env.local');
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const hasLocalSnapshotDirectory = fs.existsSync(path.resolve(import.meta.dirname, 'local-data'));

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, repoRoot, '');
  const appEnv = loadEnv(mode, import.meta.dirname, 'VITE_');
  const dataMode = process.env.VITE_DATA_MODE || appEnv.VITE_DATA_MODE || env.VITE_DATA_MODE || '';
  const selectedDataMode = dataMode.trim().toLowerCase()
    || (hasLocalSnapshotDirectory ? 'snapshot' : 'mock');
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (apiKey) process.env.GEMINI_API_KEY = apiKey;
  else delete process.env.GEMINI_API_KEY;
  const model = (env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).replace(/[\r\n]/g, '');
  process.env.GEMINI_MODEL = model;

  return {
    define: {
      'import.meta.env.VITE_DATA_MODE': JSON.stringify(dataMode),
      'import.meta.env.VITE_LOCAL_DATA_EXISTS': JSON.stringify(hasLocalSnapshotDirectory),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'snapshot-offline-assets',
        transformIndexHtml(html) {
          if (selectedDataMode !== 'snapshot') return html;
          return html.replace(/^\s*<link\b[^>]*https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)[^>]*>\s*$/gim, '');
        },
      },
      {
        name: 'alfred-server-proxy',
        configureServer(server) {
          if (command === 'serve') {
            console.info(`[Alfred] key: ${apiKey ? 'found' : 'missing'} | model: ${model} | env file checked: ${repoEnvFile}`);
          }
          server.middlewares.use('/api/alfred/status', (req, res) => handleAlfredStatus(req, res));
          server.middlewares.use('/api/alfred', (req, res) => {
            void handleAlfredRequest(req, res);
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use('/api/alfred/status', (req, res) => handleAlfredStatus(req, res));
          server.middlewares.use('/api/alfred', (req, res) => {
            void handleAlfredRequest(req, res);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 3002,
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
