import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** Every page except the homepage, which lives at "/". */
const PAGES = ['proof-of-work', 'templates', 'playbooks', 'wizard', 'about'];

/**
 * Production is served with Vercel's cleanUrls, so links point at /about
 * rather than /about.html. This teaches the dev and preview servers the same
 * trick, otherwise local navigation would 404.
 */
function extensionlessPages() {
  const rewrite = (req, _res, next) => {
    const [path, query] = (req.url || '/').split('?');
    const name = path.replace(/^\/+|\/+$/g, '');
    if (PAGES.includes(name)) {
      req.url = `/${name}.html${query ? `?${query}` : ''}`;
    }
    next();
  };

  // Block bodies matter: Vite treats a hook's return value as a post hook, and
  // middlewares.use() returns the connect app, which would then be called as one.
  return {
    name: 'extensionless-pages',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  // Served from the domain root on Vercel, so absolute asset paths are correct.
  base: '/',
  // Multi page, not a single page app. An unknown path must 404 rather than
  // quietly serving the homepage.
  appType: 'mpa',
  plugins: [extensionlessPages()],
  build: {
    outDir: 'dist',
    // three.js is already split into its own lazily imported chunk (scene.js),
    // which is only fetched on desktop viewports.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        proofOfWork: resolve(root, 'proof-of-work.html'),
        templates: resolve(root, 'templates.html'),
        playbooks: resolve(root, 'playbooks.html'),
        wizard: resolve(root, 'wizard.html'),
        about: resolve(root, 'about.html'),
      },
    },
  },
});
