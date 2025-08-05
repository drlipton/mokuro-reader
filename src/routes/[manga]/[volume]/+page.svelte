<script lang="ts">
    import { page } from '$app/stores';
    import Reader from '$lib/components/Reader/Reader.svelte';
    import Timer from '$lib/components/Reader/Timer.svelte';
    import { initializeVolume, settings, startCount, volumeSettings, volumes, updateMiscSetting } from '$lib/settings';
    import { onMount } from 'svelte';
    import { miscSettings } from '$lib/settings';
    import type { MokuroData, Page, Volume } from '$lib/types';
    import Loader from '$lib/components/Loader.svelte';
    import { catalog } from '$lib/catalog';
    import { get } from 'svelte/store';
    import { getCharCount } from '$lib/util/count-chars';
    import { getItems } from '$lib/upload/web-import';

    const mangaName = $page.params.manga;
    const volumeIdParam = $page.params.volume;
    const source = $page.url.searchParams.get('source');
    const sourceUrlFromParam = $page.url.searchParams.get('sourceUrl');
    const hasMokuro = $page.url.searchParams.get('hasMokuro') === 'true';

    let count: undefined | number = undefined;
    let loadedVolume: Volume | undefined | null = undefined;
    let uniqueVolumeId: string;

    $: if (source === 'server' && ($miscSettings.serverUrl || sourceUrlFromParam)) {
        const serverUrlForId = sourceUrlFromParam || $miscSettings.serverUrl;
        uniqueVolumeId = `${serverUrlForId}/${mangaName}/${volumeIdParam}`;
    } else if (source !== 'server') {
        uniqueVolumeId = volumeIdParam;
    }

    onMount(() => {
        if (source === 'server') {
            if (sourceUrlFromParam) {
                const savedSourcesRaw = localStorage.getItem('remoteSources');
                if (savedSourcesRaw) {
                    const savedSources: {url: string, username?: string, password?: string}[] = JSON.parse(savedSourcesRaw);
                    const correctSource = savedSources.find(s => s.url === sourceUrlFromParam);
                    if (correctSource) {
                        updateMiscSetting('serverUrl', correctSource.url);
                        updateMiscSetting('serverUsername', correctSource.username || '');
                        updateMiscSetting('serverPassword', correctSource.password || '');
                    }
                }
            }
            loadServerVolume();
        }

        if (uniqueVolumeId && !$volumes?.[uniqueVolumeId]) {
            initializeVolume(uniqueVolumeId);
        }
        if (uniqueVolumeId) {
            count = startCount(uniqueVolumeId);
        }
        return () => {
            if (count) clearInterval(count);
            count = undefined;
        };
    });

    $: {
        if (source !== 'server') {
            // This reactive block now correctly handles the asynchronous loading of the catalog
            if ($catalog) { // This check ensures we don't run until the catalog store is initialized
                const volumeFromStore = $catalog
                    ?.find((item) => item.id === mangaName)
                    ?.manga.find((item) => item.mokuroData?.volume_uuid === volumeIdParam || item.volumeName === volumeIdParam);
                
                if (volumeFromStore) {
                    // Create a shallow copy to break the direct reactive link to the store
                    // This prevents potential "Assignment to constant variable" errors in the Reader
                    loadedVolume = { ...volumeFromStore };
                } else if ($catalog.length > 0 || ($catalog.length === 0 && get(catalog) !== undefined)) {
                    // If the catalog has loaded (even if it's empty) and we still didn't find the volume, then it's truly missing.
                    loadedVolume = null;
                }
                // If catalog is still undefined, loadedVolume remains `undefined`, showing the Loader.
            }
        }
    }

    function getProxyUrl(targetUrl: string): string {
        const settings = get(miscSettings);
        let proxyUrl = `/proxy?url=${encodeURIComponent(targetUrl)}`;
        if (settings.serverUsername && settings.serverPassword) {
            proxyUrl += `&user=${encodeURIComponent(settings.serverUsername)}`;
            proxyUrl += `&pass=${encodeURIComponent(settings.serverPassword)}`;
        }
        return proxyUrl;
    }

    async function loadServerVolume() {
        const serverUrl = $miscSettings.serverUrl.replace(/\/$/, '');
        if (!serverUrl) {
            loadedVolume = null;
            return;
        }

        try {
            if (hasMokuro) {
                await loadMokuroVolume(serverUrl);
            } else {
                await loadImageOnlyVolume(serverUrl);
            }
        } catch (error) {
            console.error('Error loading server volume:', error);
            loadedVolume = null;
        }
    }

    async function loadMokuroVolume(serverUrl: string) {
        const encodedManga = encodeURIComponent(mangaName);
        const encodedVolume = encodeURIComponent(volumeIdParam);
        const mokuroUrl = `${serverUrl}/${encodedManga}/${encodedVolume}.mokuro`;

        const response = await fetch(getProxyUrl(mokuroUrl));
        if (!response.ok) throw new Error(`Failed to fetch .mokuro file (${response.status})`);

        const mokuroData: MokuroData = await response.json();
        mokuroData.volume_uuid = uniqueVolumeId;

        const files: Record<string, string> = {};
        const imageBaseUrl = `${serverUrl}/${encodedManga}/${encodedVolume}`;
        mokuroData.pages.forEach((page) => {
            const pageUrl = `${imageBaseUrl}/${page.img_path}`;
            files[page.img_path] = getProxyUrl(pageUrl);
        });

        if (uniqueVolumeId) {
            volumes.update(v => {
                if (!v[uniqueVolumeId]) initializeVolume(uniqueVolumeId);
                v[uniqueVolumeId].totalPages = mokuroData.pages.length;
                return v;
            });
        }
        loadedVolume = { mokuroData, volumeName: volumeIdParam, files };
    }

    async function loadImageOnlyVolume(serverUrl: string) {
        const encodedManga = encodeURIComponent(mangaName);
        const encodedVolume = encodeURIComponent(volumeIdParam);
        const volumeUrl = `${serverUrl}/${encodedManga}/${encodedVolume}/`;
        
        const response = await fetch(getProxyUrl(volumeUrl));
        if (!response.ok) throw new Error(`Failed to fetch volume directory (${response.status})`);

        const html = await response.text();
        const items = getItems(html, volumeUrl);
        const imageRegex = /\.(jpg|jpeg|png|webp)$/i;
        
        const imagePaths = items
            .map(item => item.pathname.split('/').pop())
            .filter((name): name is string => name !== null && imageRegex.test(name))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (imagePaths.length === 0) throw new Error('No images found in volume directory.');

        const files: Record<string, string> = {};
        imagePaths.forEach(imgPath => {
            files[imgPath] = getProxyUrl(`${volumeUrl}${imgPath}`);
        });

        if (uniqueVolumeId) {
            volumes.update(v => {
                if (!v[uniqueVolumeId]) initializeVolume(uniqueVolumeId);
                v[uniqueVolumeId].totalPages = imagePaths.length;
                return v;
            });
        }
        
        loadedVolume = {
            volumeName: volumeIdParam,
            files
        };
    }
</script>

{#if loadedVolume === undefined}
    <Loader>Loading Volume...</Loader>
{:else if loadedVolume === null}
    <div class="text-center p-16 text-red-400">
        <p>Failed to load volume.</p>
        <p class="text-sm text-gray-500 mt-2">
            Please check the server URL or ensure the local files are correct.
        </p>
    </div>
{:else}
    {@const volumeId = loadedVolume.mokuroData?.volume_uuid || uniqueVolumeId}
    {#if $volumeSettings[volumeId]}
        {#if $settings.showTimer}
            <Timer bind:count {volumeId} />
        {/if}
        <Reader {loadedVolume} volumeSettings={$volumeSettings[volumeId]} />
    {/if}
{/if}
