import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (name) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  // Relative base so the built site can be dropped on any static host or subpath.
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        index: page('index'),
        'reference-build': page('reference-build'),
        templates: page('templates'),
        playbooks: page('playbooks'),
        wizard: page('wizard'),
        about: page('about'),
      },
    },
  },
  server: {
    open: true,
  },
});
