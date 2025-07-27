<script lang="ts">
  import { volumes, miscSettings } from '$lib/settings';
  import { catalog } from '$lib/catalog';
  import { derived } from 'svelte/store';
  import { fetchServerMangaInfo } from '$lib/catalog/server';
  import { onMount, tick } from 'svelte';
  import type { Volume } from '$lib/types';
  import { Badge } from 'flowbite-svelte';

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
  };

  let historyItems: HistoryItem[] = [];
  let loading = true;

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
      .slice(0, 3)
      .map(([id, data]): HistoryItem | null => {
        const isRemote = id.startsWith('http');
        if (isRemote) {
            const parts = id.split('/');
            const volumeName = decodeURIComponent(parts.pop() || '');
            const mangaTitle = decodeURIComponent(parts.pop() || '');
            return {
                id, ...data, isRemote, mangaTitle, volumeName,
                href: `/${encodeURIComponent(mangaTitle)}/${encodeURIComponent(volumeName)}?source=server`
            };
        } else {
            const localInfo = allLocalVolumes.get(id);
            if (!localInfo) return null;
            return {
                id, ...data, isRemote,
                mangaTitle: localInfo.volume.mokuroData.title,
                volumeName: localInfo.volume.volumeName,
                href: `/${localInfo.mangaId}/${id}`
            };
        }
      }).filter((item): item is HistoryItem => item !== null);
  });

  onMount(() => {
    const unsubscribe = historyStore.subscribe(async (items) => {
        if (items.length === 0) {
            historyItems = [];
            return;
        }

        loading = true;
        await tick();

        const updatedItems = await Promise.all(items.map(async (item) => {
            if (item.isRemote) {
                const { coverArt } = await fetchServerMangaInfo($miscSettings.serverUrl, item.mangaTitle!);
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

  $: serverOffline = $miscSettings.source === 'local' && !$catalog;
</script>

{#if historyItems.length > 0}
  <div class="p-2 mb-6">
    <h2 class="text-xl font-semibold mb-4 text-white">Continue Reading</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each historyItems as item (item.id)}
        {@const isDisabled = item.isRemote && !$miscSettings.serverUrl}
        <a href={isDisabled ? '#' : item.href} class="bg-gray-800 rounded-lg p-3 flex items-center gap-4 {isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}">
          {#if loading || !item.coverArtUrl}
            <div class="w-16 h-24 bg-gray-700 animate-pulse rounded flex-shrink-0"></div>
          {:else}
            <img src={item.coverArtUrl} alt="Cover for {item.volumeName}" class="w-16 h-24 object-cover rounded flex-shrink-0" />
          {/if}
          <div class="flex-1 overflow-hidden">
            <p class="font-semibold truncate text-white" title={item.mangaTitle}>{item.mangaTitle}</p>
            <p class="text-sm text-gray-400 truncate" title={item.volumeName}>{item.volumeName}</p>
            <div class="text-xs mt-2 flex items-center gap-2">
              <span class="text-gray-300">Page {item.progress} / {item.totalPages || '?'}</span>
              <Badge color={item.isRemote ? 'blue' : 'green'}>{item.isRemote ? 'Remote' : 'Local'}</Badge>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </div>
{/if}