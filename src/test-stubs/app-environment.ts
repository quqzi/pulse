// Stub for SvelteKit's `$app/environment` so store/lib modules are importable under Vitest
// (node env, no SvelteKit Vite plugin). Aliased in vitest.config.ts.
export const browser = false;
export const dev = false;
export const building = false;
export const version = 'test';
