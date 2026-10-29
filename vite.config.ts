import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rolldownOptions: {
      output: {
        // React has its own group (highest priority) so shared React modules never land in the motion chunk;
        // otherwise every route, including /cupcake/robyn, preloads framer-motion.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/, priority: 30 },
            { name: 'three', test: /[/\\]node_modules[/\\](three|@react-three)[/\\]/, priority: 20 },
            { name: 'motion', test: /[/\\]node_modules[/\\](framer-motion|@react-spring)[/\\]/, priority: 20 },
            { name: 'vapi', test: /[/\\]node_modules[/\\]@vapi-ai[/\\]/, priority: 20 },
          ],
        },
      },
    },
  },
});
