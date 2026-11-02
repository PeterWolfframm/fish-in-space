import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { studioPlugin } from './studio/vite-plugin-studio.ts';

const srcRoot = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@studio-forge': srcRoot },
  },
  plugins: [preact(), studioPlugin(srcRoot)],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: fileURLToPath(new URL('./studio.html', import.meta.url)),
    },
  },
});
