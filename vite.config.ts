import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[/\\](three|@react-three)[/\\]/.test(id)) return 'three';
          if (/[/\\](framer-motion|@react-spring)[/\\]/.test(id)) return 'motion';
          if (id.includes('@vapi-ai')) return 'vapi';
          return undefined;
        },
      },
    },
  },
});
