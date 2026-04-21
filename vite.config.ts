import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
      'process.env.VITE_GEMINI_API_KEY_1': JSON.stringify(env.GEMINI_API_KEY_1 || env.VITE_GEMINI_API_KEY_1 || ''),
      'process.env.VITE_GEMINI_API_KEY_2': JSON.stringify(env.GEMINI_API_KEY_2 || env.VITE_GEMINI_API_KEY_2 || ''),
      'process.env.VITE_GEMINI_API_KEY_3': JSON.stringify(env.GEMINI_API_KEY_3 || env.VITE_GEMINI_API_KEY_3 || ''),
      'process.env.VITE_GEMINI_API_KEY_4': JSON.stringify(env.GEMINI_API_KEY_4 || env.VITE_GEMINI_API_KEY_4 || ''),
      'process.env.VITE_GEMINI_API_KEY_5': JSON.stringify(env.GEMINI_API_KEY_5 || env.VITE_GEMINI_API_KEY_5 || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  }
});
