import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

/**
 * robots.txt, written from .env: private pages stay out of search engines,
 * and the sitemap is the API's (it lists every part and shop).
 */
function robots(env: Record<string, string>): Plugin {
  const api = env.VITE_API_URL?.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  const sitemap = `${api || env.VITE_SITE_URL?.replace(/\/+$/, '') || ''}/sitemap.xml`;
  const text = [
    'User-agent: *',
    ...['/account', '/notifications', '/sell', '/saved', '/login', '/register', '/verify', '/forgot-password', '/reset-password'].map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');
  return {
    name: 'robots',
    configureServer(server) {
      server.middlewares.use('/robots.txt', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(text);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: text });
    },
  };
}

// In development the API is proxied, so the browser sees one origin:
// no CORS setup on the backend and photos load as they are.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://localhost:3000';
  return {
    plugins: [react(), robots(env)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      // 5173 is the admin dashboard's port.
      port: 5174,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true },
        '/sitemap.xml': { target, changeOrigin: true },
      },
    },
  };
});
