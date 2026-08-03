import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    // Registration is done explicitly in src/routes/+layout.svelte (Task 17)
    // so we control exactly when it happens instead of SvelteKit's automatic
    // window-load registration.
    serviceWorker: { register: false }
  }
};
