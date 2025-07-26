/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// Ignore requests to other origins
		if (url.origin !== self.location.origin) {
			return fetch(event.request);
		}

		if (ASSETS.includes(url.pathname)) {
			return cache.match(url.pathname);
		}

		try {
			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (e) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}
			console.error('Fetch failed and not in cache:', e);
			// Return a proper error response if fetch fails and it's not in the cache
			return new Response('Network error: file not found in cache', {
				status: 404,
				headers: { 'Content-Type': 'text/plain' }
			});
		}
	}

	event.respondWith(respond());
});