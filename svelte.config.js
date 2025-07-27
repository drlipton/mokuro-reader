import adapter from '@sveltejs/adapter-node'; // Change this line
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter() // And change this line
	},
	vitePlugin: {
		inspector: true
	}
};

export default config;