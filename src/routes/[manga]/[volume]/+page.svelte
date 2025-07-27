<script lang="ts">
    import { page } from '$app/stores';
    import Reader from '$lib/components/Reader/Reader.svelte';
    import Timer from '$lib/components/Reader/Timer.svelte';
    import { initializeVolume, settings, startCount, volumeSettings, volumes } from '$lib/settings';
    import { onMount } from 'svelte';
    import { miscSettings } from '$lib/settings';
    import type { MokuroData, Volume } from '$lib/types';
    import Loader from '$lib/components/Loader.svelte';
    import { catalog } from '$lib/catalog';
    import { get } from 'svelte/store';
    import { getCharCount } from '$lib/util/count-chars';

    const mangaName = $page.params.manga;
    const volumeIdParam = $page.params.volume;
    const source = $page.url.searchParams.get('source');

    let count: undefined | number = undefined;
    let loadedVolume: Volume | undefined | null = undefined;
    let uniqueVolumeId: string;

    $: if (source === 'server' && $miscSettings.serverUrl) {
        uniqueVolumeId = `${$miscSettings.serverUrl}/${mangaName}/${volumeIdParam}`;
    } else if (source !== 'server') {
        uniqueVolumeId = volumeIdParam;
    }

    onMount(() => {
        if (source === 'server') {
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
    $: if (source !== 'server' && $catalog) {
        loadedVolume = $catalog
            ?.find((item) => item.id === mangaName)
            ?.manga.find((item) => item.mokuroData.volume_uuid === volumeIdParam);
    }

    // Corrected getProxyUrl function
    function getProxyUrl(targetUrl: string): string {
        const settings = get(miscSettings);
        let proxyUrl = `/proxy?url=${encodeURIComponent(targetUrl)}`; // Corrected proxy endpoint
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
            const encodedManga = encodeURIComponent(mangaName);
            const encodedVolume = encodeURIComponent(volumeIdParam);
            const mokuroUrl = `${serverUrl}/${encodedManga}/${encodedVolume}.mokuro`;

            // Fetch using the corrected proxy URL
            const response = await fetch(getProxyUrl(mokuroUrl));
            if (!response.ok) throw new Error(`Failed to fetch .mokuro file (${response.status})`);

            const mokuroData: MokuroData = await response.json();
            mokuroData.volume_uuid = uniqueVolumeId;
            const files: Record<string, string> = {};
            const imageBaseUrl = `${serverUrl}/${encodedManga}/${encodedVolume}`;
            mokuroData.pages.forEach((page) => {
                const pageUrl = `${imageBaseUrl}/${page.img_path}`;
                files[page.img_path] = getProxyUrl(pageUrl); // Fetch image URLs via proxy
            });

            // Save total pages to volumes store
            if (uniqueVolumeId) {
                volumes.update(v => {
                    if (!v[uniqueVolumeId]) {
                        initializeVolume(uniqueVolumeId);
                    }
                    v[uniqueVolumeId].totalPages = mokuroData.pages.length;
                    return v;
                });
            }

            loadedVolume = {
                mokuroData,
                volumeName: volumeIdParam,
                files
            };
        } catch (error) {
            console.error('Error loading server volume:', error);
            loadedVolume = null;
        }
    }
</script>

{#if loadedVolume === undefined}
    <Loader>Loading Volume...</Loader>
{:else if loadedVolume === null}
    <div class="text-center p-16 text-red-400">
        <p>Failed to load volume from the server.</p>
        <p class="text-sm text-gray-500 mt-2">
            Please check the server URL, your network connection, and ensure the manga files exist.
        </p>
    </div>
{:else}
    {@const volumeId = loadedVolume.mokuroData.volume_uuid}
    {#if $volumeSettings[volumeId]}
        {#if $settings.showTimer}
            <Timer bind:count {volumeId} />
        {/if}
        <Reader {loadedVolume} volumeSettings={$volumeSettings[volumeId]} />
    {/if}
{/if}