import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'CAPITALSCOPE_');
  return { plugins: [react()], server: {
    proxy: { '/api': env.CAPITALSCOPE_API_TARGET || 'http://127.0.0.1:8080' }
  }};
});
