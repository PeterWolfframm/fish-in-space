import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const forge = fileURLToPath(new URL('./forge', import.meta.url));

export default defineConfig({
  base: './',
  resolve: { alias: { '@forge': forge } },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Seedfall',
        short_name: 'Seedfall',
        description: 'Breed pixel fish in an orbital hatchery and seed the oceans of a newly terraformed planet.',
        theme_color: '#04050b',
        background_color: '#04050b',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
