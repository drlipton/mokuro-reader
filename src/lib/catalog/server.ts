// src/lib/catalog/server.ts
import { getItems } from '$lib/upload/web-import';
import { miscSettings } from '$lib/settings';
import { get } from 'svelte/store';

// Function to construct the proxy URL with authentication parameters
function getProxyUrl(targetUrl: string): string {
    const settings = get(miscSettings);
    let proxyUrl = `/proxy?url=${encodeURIComponent(targetUrl)}`;

    if (settings.serverUsername && settings.serverPassword) {
        proxyUrl += `&user=${encodeURIComponent(settings.serverUsername)}`;
        proxyUrl += `&pass=${encodeURIComponent(settings.serverPassword)}`;
    }
    return proxyUrl;
}

export async function fetchServerMangaList(serverUrl: string): Promise<string[]> {
    if (!serverUrl) return [];

    try {
        const response = await fetch(getProxyUrl(serverUrl));
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const html = await response.text();
        const items = getItems(html);

        return items
            .map((item) => {
                let name = item.pathname;
                if (name.endsWith('/')) {
                    name = name.replace(/^\/|\/$/g, '');
                    return decodeURIComponent(name);
                }
                return null;
            })
            .filter((name): name is string => name !== null && name !== '..' && !name.startsWith('.'));

    } catch (error) {
        console.error('Error fetching server manga list:', error);
        throw new Error('Could not connect to the server. Check the URL and your network connection.');
    }
}

export async function fetchServerVolumeList(serverUrl: string, mangaName: string): Promise<string[]> {
    if (!serverUrl || !mangaName) return [];

    // MODIFIED LINE: Ensure a trailing slash for directories
    const mangaUrl = `${serverUrl.replace(/\/$/, '')}/${encodeURIComponent(mangaName)}/`;

    try {
        const response = await fetch(getProxyUrl(mangaUrl));
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const html = await response.text();
        const items = getItems(html);

        return items
            .map((item) => {
                let name = item.pathname.split('/').pop();
                if (name && name.toLowerCase().endsWith('.mokuro')) {
                    return decodeURIComponent(name.slice(0, -7));
                }
                return null;
            })
            .filter((name): name is string => name !== null);

    } catch (error) {
        console.error(`Error fetching volumes for ${mangaName}:`, error);
        throw new Error(`Could not load volumes for "${mangaName}". Check the server for a valid directory.`);
    }
}