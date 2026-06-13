import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // Inline page CSS into the HTML <head> instead of emitting render-blocking
    // <link> tags. Eliminates the flash-of-unstyled-content (raw blue nav links /
    // white screen) seen when the route/component CSS chunk hadn't applied yet.
    inlineStyleThreshold: 1024 * 50,
  },
};
