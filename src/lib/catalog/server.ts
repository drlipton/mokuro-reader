import { getItems } from '$lib/upload/web-import';

/**
 * Fetches the list of manga series from a server URL.
 * Assumes the server returns an HTML page with directory listings.
 * @param serverUrl The base URL of the manga server.
 * @returns A promise that resolves to an array of manga series names.
 */
export async function fetchServerMangaList(serverUrl: string): Promise<string[]> {
	if (!serverUrl) {
		return [];
	}

	try {
		const response = await fetch(serverUrl);
		if (!response.ok) {
			throw new Error(`Server returned ${response.status}: ${response.statusText}`);
		}
		const html = await response.text();
		const items = getItems(html);

		// Filter for links that are likely directories (end with '/') and are not 'Parent Directory' links.
		const mangaList = items
			.map((item) => {
				let name = item.pathname;
				if (name.endsWith('/')) {
					// Remove leading and trailing slashes
					name = name.replace(/^\/|\/$/g, '');
					// Decode URI component to handle spaces etc. e.g., "%20" -> " "
					return decodeURIComponent(name);
				}
				return null;
			})
			.filter((name): name is string => name !== null && name !== '..' && !name.startsWith('.'));

		return mangaList;
	} catch (error) {
		console.error('Error fetching server manga list:', error);
		// Re-throw a more user-friendly error
		throw new Error('Could not connect to the server. Check the URL and your network connection.');
	}
}

/**
 * Fetches the list of volumes for a specific manga from the server.
 * @param serverUrl The base URL of the manga server.
 * @param mangaName The name of the manga series.
 * @returns A promise that resolves to an array of volume names.
 */
export async function fetchServerVolumeList(serverUrl: string, mangaName: string): Promise<string[]> {
	if (!serverUrl || !mangaName) {
		return [];
	}

	const mangaUrl = `${serverUrl.replace(/\/$/, '')}/${encodeURIComponent(mangaName)}`;
	try {
		const response = await fetch(mangaUrl);
		if (!response.ok) {
			throw new Error(`Server returned ${response.status}: ${response.statusText}`);
		}
		const html = await response.text();
		const items = getItems(html);

		// Filter for files that end with .mokuro
		const volumeList = items
			.map((item) => {
				let name = item.pathname.split('/').pop(); // Get filename from path
				if (name && name.toLowerCase().endsWith('.mokuro')) {
					// Remove the .mokuro extension and decode
					return decodeURIComponent(name.slice(0, -7));
				}
				return null;
			})
			.filter((name): name is string => name !== null);

		return volumeList;
	} catch (error) {
		console.error(`Error fetching volumes for ${mangaName}:`, error);
		throw new Error(`Could not load volumes for "${mangaName}". Check the server for a valid directory.`);
	}
}