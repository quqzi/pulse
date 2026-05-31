import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve $lib ourselves so we don't need the SvelteKit Vite plugin in tests.
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      // Stub SvelteKit's $app/environment so store modules (which import `browser`) load under Vitest.
      '$app/environment': fileURLToPath(new URL('./src/test-stubs/app-environment.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // Only our unit tests — keeps the Playwright specs under ./tests out of Vitest.
    include: ['src/**/*.{test,spec}.ts'],
  },
});
