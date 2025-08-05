<script lang="ts">
  import { volumes, miscSettings, updateMiscSetting } from '$lib/settings';
  import { catalog } from '$lib/catalog';
  import { derived } from 'svelte/store';
  import { fetchServerMangaInfo } from '$lib/catalog/server';
  import { onMount, tick } from 'svelte';
  import type { Volume } from '$lib/types';
  import { Badge, Button, Search } from 'flowbite-svelte';
  import { GridOutline, ListOutline } from 'flowbite-svelte-icons';

  // --- CONFIGURATION ---
  const historyLimit = 40;

  // --- TYPES ---
  type HistoryItem = {
    id: string;
    progress: number;
    totalPages?: number;
    isRemote: boolean;
    lastRead?: number;
    mangaTitle?: string;
    volumeName?: string;
    coverArtUrl?: string;
    href?: string;
    sourceUrl?: string;
    isAvailable: boolean;
  };

  // --- STATE ---
  let historyItems: HistoryItem[] = [];
  let loading = true;
  let searchFilter = '';
  let availableSources: string[] = [];

  // --- LIFECYCLE ---
  onMount(() => {
    const savedSources = localStorage.getItem('remoteSources');
    if (savedSources) {
      availableSources = JSON.parse(savedSources).map((s: { url: string }) => s.url);
    }

    const unsubscribe = historyStore.subscribe(async (items) => {
        if (!items || items.length === 0) {
            historyItems = [];
            loading = false;
            return;
        }

        loading = true;
        await tick();

        const updatedItems = await Promise.all(items.map(async (item) => {
            if (item.coverArtUrl) return item;

            if (item.isRemote && item.mangaTitle) {
                const { coverArt } = await fetchServerMangaInfo(item.sourceUrl!, item.mangaTitle);
                item.coverArtUrl = coverArt;
            } else {
                const localVolume = $catalog?.flatMap(m => m.manga).find(v => v.mokuroData.volume_uuid === item.id);
                if (localVolume?.files) {
                    const coverFile = Object.values(localVolume.files)[0];
                    if (coverFile instanceof File) {
                        item.coverArtUrl = URL.createObjectURL(coverFile);
                    }
                }
            }
            return item;
        }));
        historyItems = updatedItems;
        loading = false;
    });

    return unsubscribe;
  });

  // --- DERIVED STATE ---
  const historyStore = derived([volumes, catalog], ([$volumes, $catalog]) => {
    if (!$volumes || !$catalog) return [];

    const allLocalVolumes = new Map<string, { volume: Volume, mangaId: string }>();
    $catalog.forEach(mangaSeries => {
        mangaSeries.manga.forEach(vol => {
            allLocalVolumes.set(vol.mokuroData.volume_uuid, { volume: vol, mangaId: mangaSeries.id });
        });
    });

    return Object.entries($volumes)
      .filter(([, data]) => data.lastRead && data.progress > 0)
      .sort(([, a], [, b]) => (b.lastRead || 0) - (a.lastRead || 0))
      .slice(0, historyLimit)
      .map(([id, data]): HistoryItem | null => {
        const isRemote = id.startsWith('http');
        if (isRemote) {
            const urlParts = id.split('/');
            const volumeName = decodeURIComponent(urlParts.pop() || '');
            const mangaTitle = decodeURIComponent(urlParts.pop() || '');
            const sourceUrl = urlParts.join('/');
            
            return {
                id, ...data, isRemote, mangaTitle, volumeName, sourceUrl,
                href: `/${encodeURIComponent(mangaTitle)}/${encodeURIComponent(volumeName)}?source=server&sourceUrl=${encodeURIComponent(sourceUrl)}`,
                isAvailable: availableSources.includes(sourceUrl)
            };
        } else {
            const localInfo = allLocalVolumes.get(id);
            if (!localInfo) return null;
            return {
                id, ...data, isRemote,
                mangaTitle: localInfo.volume.mokuroData.title,
                volumeName: localInfo.volume.volumeName,
                href: `/${localInfo.mangaId}/${id}`,
                isAvailable: true
            };
        }
      }).filter((item): item is HistoryItem => item !== null);
  });

  $: filteredHistory = historyItems.filter(item => 
    item.mangaTitle?.toLowerCase().includes(searchFilter.toLowerCase()) || 
    item.volumeName?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // --- UI FUNCTIONS ---
  function onLayout() {
    updateMiscSetting('galleryLayout', $miscSettings.galleryLayout === 'list' ? 'grid' : 'list');
  }

  function formatDate(timestamp: number | undefined): string {
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric'
      });
  }
</script>

<div class="p-2 mb-6">
  <div class="flex gap-1 py-2">
    <Search bind:value={searchFilter} placeholder="Filter history..." />
    <Button size="sm" color="alternative" on:click={onLayout}>
      {#if $miscSettings.galleryLayout === 'list'}
        <GridOutline />
      {:else}
        <ListOutline />
      {/if}
    </Button>
  </div>

  {#if loading}
    <div class="text-center p-20">
      <p>Loading History...</p>
    </div>
  {:else if historyItems.length === 0}
    <div class="text-center p-20">
        <p>No reading history yet.</p>
        <p class="text-gray-500">Start reading a manga to see it here.</p>
    </div>
  {:else if filteredHistory.length === 0}
    <div class="text-center p-20">
        <p>No history items match your filter.</p>
    </div>
  {:else if $miscSettings.galleryLayout === 'grid'}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {#each filteredHistory as item (item.id)}
        {@const isDisabled = !item.isAvailable}
        <a href={isDisabled ? '#' : item.href} class="group {isDisabled ? 'opacity-50 cursor-not-allowed' : ''}">
          <div class="bg-gray-800 rounded-lg overflow-hidden">
            {#if !item.coverArtUrl}
              <div class="w-full aspect-[2/3] bg-gray-700 animate-pulse"></div>
            {:else}
              <img src={item.coverArtUrl} alt="Cover for {item.volumeName}" class="w-full aspect-[2/3] object-cover" />
            {/if}
            <div class="p-2">
              <p class="font-semibold truncate text-white" title={item.mangaTitle}>{item.mangaTitle}</p>
              <p class="text-sm text-gray-400 truncate" title={item.volumeName}>{item.volumeName}</p>
              <p class="text-xs text-gray-300 mt-1">Page {item.progress} / {item.totalPages || '?'}</p>
              <p class="text-xs text-gray-500 mt-1">{formatDate(item.lastRead)}</p>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {:else} <div class="flex flex-col gap-3">
      {#each filteredHistory as item (item.id)}
        {@const isDisabled = !item.isAvailable}
        <a href={isDisabled ? '#' : item.href} class="bg-gray-800 rounded-lg p-3 flex items-center gap-4 {isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}">
          {#if !item.coverArtUrl}
            <div class="w-16 h-24 bg-gray-700 animate-pulse rounded flex-shrink-0"></div>
          {:else}
            <img src={item.coverArtUrl} alt="Cover for {item.volumeName}" class="w-16 h-24 object-cover rounded flex-shrink-0" />
          {/if}
          <div class="flex-1 overflow-hidden">
            <p class="font-semibold truncate text-white" title={item.mangaTitle}>{item.mangaTitle}</p>
            <p class="text-sm text-gray-400 truncate" title={item.volumeName}>{item.volumeName}</p>
             <p class="text-xs text-gray-500 mt-1">{formatDate(item.lastRead)}</p>
            <div class="text-xs mt-2 flex items-center gap-2 flex-wrap">
              <span class="text-gray-300">Page {item.progress} / {item.totalPages || '?'}</span>
              <Badge color={item.isRemote ? 'blue' : 'green'}>{item.isRemote ? 'Remote' : 'Local'}</Badge>
              {#if item.isRemote}
                <Badge color="purple" class="truncate max-w-[150px]">{item.sourceUrl}</Badge>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>