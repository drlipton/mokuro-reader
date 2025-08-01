// src/lib/catalog/server.ts
import { getItems } from '$lib/upload/web-import';
import { miscSettings } from '$lib/settings';
import { get } from 'svelte/store';
import { db } from './db';
import { resizeImage } from '$lib/util/image';

// Function to construct the proxy URL with authentication parameters
export function getProxyUrl(targetUrl: string): string {
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

    const mangaUrl = `${serverUrl.replace(/\/$/, '')}/${encodeURIComponent(mangaName)}/`;

    try {
        const response = await fetch(getProxyUrl(mangaUrl));
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const html = await response.text();
        const items = getItems(html);

        const volumes = items
            .map((item) => {
                let name = item.pathname.split('/').pop();
                if (name && name.toLowerCase().endsWith('.mokuro')) {
                    return decodeURIComponent(name.slice(0, -7));
                }
                return null;
            })
            .filter((name): name is string => name !== null);

        // Sort volumes alphanumerically to ensure a consistent order
        return volumes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    } catch (error) {
        console.error(`Error fetching volumes for ${mangaName}:`, error);
        throw new Error(`Could not load volumes for "${mangaName}". Check the server for a valid directory.`);
    }
}

export async function fetchServerMangaInfo(serverUrl: string, mangaName: string): Promise<{ coverArt: string, volumeCount: number }> {
    if (!serverUrl || !mangaName) return { coverArt: '', volumeCount: 0 };

    const cacheId = `remote-${serverUrl}-${mangaName}`;
    
    // 1. Check for a cached thumbnail
    const cached = await db.thumbnails.get(cacheId);
    if (cached) {
        return { coverArt: URL.createObjectURL(cached.thumbnail), volumeCount: 0 }; // volumeCount not needed here
    }

    try {
        const volumes = await fetchServerVolumeList(serverUrl, mangaName);
        if (volumes.length === 0) {
            return { coverArt: '', volumeCount: 0 };
        }
        const firstVolumeName = volumes[0];

        const encodedManga = encodeURIComponent(mangaName);
        const encodedVolume = encodeURIComponent(firstVolumeName);
        const mokuroUrl = `${serverUrl.replace(/\/$/, '')}/${encodedManga}/${encodedVolume}.mokuro`;

        const mokuroResponse = await fetch(getProxyUrl(mokuroUrl));
        if (!mokuroResponse.ok) {
            console.warn(`Could not fetch .mokuro for cover art for ${mangaName}`);
            return { coverArt: '', volumeCount: volumes.length };
        }
        const mokuroData = await mokuroResponse.json();

        if (!mokuroData.pages || mokuroData.pages.length === 0) {
            return { coverArt: '', volumeCount: volumes.length };
        }

        const coverImagePath = mokuroData.pages[0].img_path;
        const coverArtUrl = `${serverUrl.replace(/\/$/, '')}/${encodedManga}/${encodedVolume}/${coverImagePath}`;

        // 2. Fetch, resize, and cache the thumbnail
        const imageResponse = await fetch(getProxyUrl(coverArtUrl));
        if (!imageResponse.ok) return { coverArt: '', volumeCount: volumes.length };

        const imageBlob = await imageResponse.blob();
        const thumbnailBlob = await resizeImage(imageBlob, 250, 350); // Resize to match catalog item size
        
        await db.thumbnails.put({ id: cacheId, thumbnail: thumbnailBlob });
        
        return { coverArt: URL.createObjectURL(thumbnailBlob), volumeCount: volumes.length };

    } catch (error) {
        console.error(`Error fetching info for ${mangaName}:`, error);
        return { coverArt: '', volumeCount: 0 };
    }
}