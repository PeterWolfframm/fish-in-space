import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Rules tests only: no Preact or PWA plugins, plain Node.
export default defineConfig({
  resolve: { alias: { '@forge': fileURLToPath(new URL('./forge', import.meta.url)) } },
  test: { environment: 'node', include: ['test/**/*.test.ts'], pool: 'threads' },
});
