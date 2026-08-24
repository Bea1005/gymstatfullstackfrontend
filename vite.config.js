import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendPortFile = path.resolve(__dirname, '../backend/.port');

const getBackendPort = () => {
  try {
    const value = fs.readFileSync(backendPortFile, 'utf8').trim();
    const port = Number(value);
    return Number.isInteger(port) && port > 0 ? port : 4000;
  } catch {
    return 4000;
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${getBackendPort()}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1')
      },
      '/uploads': {
        target: `http://127.0.0.1:${getBackendPort()}`,
        changeOrigin: true
      }
    }
  }
});