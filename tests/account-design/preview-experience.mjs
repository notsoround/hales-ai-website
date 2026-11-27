// Local, fictional account for a design walkthrough. Run from the website repository root.
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const cacheDir = mkdtempSync(join(tmpdir(), 'cupcake-design-review-'));
const server = await createServer({
  root, cacheDir, envDir: cacheDir,
  define: { 'import.meta.env.VITE_CUPCAKE_ACCOUNT_SESSIONS': '"true"' },
  optimizeDeps: { entries: ['tests/experience-review-preview.ts'] },
  server: {
    host: '127.0.0.1', port: 5376, strictPort: true, hmr: false,
    fs: { allow: [root, realpathSync('node_modules')] },
    headers: { 'Content-Security-Policy': "connect-src 'self' ws://127.0.0.1:5376; form-action 'none'; img-src 'self' blob: data:; media-src 'self' blob: data:" },
  },
  plugins: [{
    name: 'synthetic-cupcake-entrance',
    configureServer(s) {
      s.middlewares.use((req, _res, next) => {
        const entry = new URL(req.url || '/', 'http://127.0.0.1:5376');
        if (entry.pathname === '/cupcake/account') {
          req.url = entry.searchParams.get('demo') === 'photo-retry'
            ? '/tests/account-receipt-photo-preview.html' : '/tests/account-browser-preview.html';
        }
        next();
      });
    },
    transformIndexHtml(html, context) {
      if (!context.filename.endsWith('/tests/account-browser-preview.html')) return html;
      return html.replace('/tests/account-browser-preview.tsx','/tests/experience-review-preview.ts');
    },
  }],
});
await server.listen();
console.log('Open http://127.0.0.1:5376/cupcake/account?tab=feed&rich=1');
