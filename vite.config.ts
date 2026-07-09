import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	build: {
		// School PCs run years-old Chrome; keep the bundle parseable down to
		// ~Chrome 90 instead of Vite's modern default (~Chrome 107+).
		target: ['chrome90', 'safari14', 'firefox90'],
	},
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			manifest: {
				name: 'Pulse',
				short_name: 'Pulse',
				description: 'Study Tracker',
				theme_color: '#f43f5e',
				background_color: '#f2f2f7',
				display: 'standalone',
				orientation: 'portrait',
				start_url: '/dashboard',
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
				],
			},
			strategies: 'generateSW',
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
						handler: 'NetworkFirst',
						options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 10 },
					},
				],
			},
		}),
	],
});
