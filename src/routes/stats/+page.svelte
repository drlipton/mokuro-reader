<script lang="ts">
  import { onMount } from 'svelte';
  import { volumes } from '$lib/settings';
  import { catalog } from '$lib/catalog';
  import { derived } from 'svelte/store';
  import Loader from '$lib/components/Loader.svelte';
  import { Progressbar } from 'flowbite-svelte';
  import { fetchServerMangaInfo, fetchServerVolumeList } from '$lib/catalog/server';
  import type { Volume } from '$lib/types';

  // --- TYPES ---
  type MangaStats = {
    normalizedTitle: string;
    displayTitle: string;
    volumesRead: number;
    totalVolumes: number;
    pagesRead: number;
    charsRead: number;
    minutesRead: number;
    coverArtUrl?: string;
    lastRead: number;
  };

  // --- UTILITY ---
  function normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // --- DERIVED STATE ---
  let aggregatedStats = derived([volumes, catalog], ([$volumes, $catalog], set) => {
    if (!$volumes || !$catalog) {
      set([]);
      return;
    }

    const stats: Map<string, MangaStats> = new Map();

    const processVolume = (volumeData, title) => {
      const normalizedTitle = normalizeTitle(title);
      let entry = stats.get(normalizedTitle);

      if (!entry) {
        entry = {
          normalizedTitle,
          displayTitle: title,
          volumesRead: 0,
          totalVolumes: 0,
          pagesRead: 0,
          charsRead: 0,
          minutesRead: 0,
          lastRead: 0,
        };
      }
      
      entry.pagesRead += volumeData.progress || 0;
      entry.charsRead += volumeData.chars || 0;
      entry.minutesRead += volumeData.timeReadInMinutes || 0;

      if (volumeData.completed) {
        entry.volumesRead++;
      }
      if (volumeData.lastRead && volumeData.lastRead > entry.lastRead) {
          entry.lastRead = volumeData.lastRead;
      }
      stats.set(normalizedTitle, entry);
    };

    // Process local volumes
    $catalog.forEach(mangaSeries => {
      const title = mangaSeries.manga[0]?.mokuroData?.title;
      if (title) {
        const normalizedTitle = normalizeTitle(title);
        let entry = stats.get(normalizedTitle) || { displayTitle: title, totalVolumes: 0, volumesRead: 0, pagesRead: 0, charsRead: 0, minutesRead: 0, lastRead: 0, normalizedTitle };
        // Set local volume count
        entry.totalVolumes = mangaSeries.manga.length;

        mangaSeries.manga.forEach(vol => {
          const volumeData = $volumes[vol.mokuroData.volume_uuid];
          if (volumeData) {
            processVolume(volumeData, title);
          }
        });

        const coverFile = Object.values(mangaSeries.manga[0].files)[0];
        if (coverFile instanceof File) {
          entry.coverArtUrl = URL.createObjectURL(coverFile);
        }
        stats.set(normalizedTitle, entry);
      }
    });

    // Process remote volumes
    Object.entries($volumes).forEach(([id, data]) => {
      if (id.startsWith('http')) {
        const urlParts = id.split('/');
        urlParts.pop(); // volume name
        const mangaTitle = decodeURIComponent(urlParts.pop() || '');
        processVolume(data, mangaTitle);
      }
    });
    
    const finalStats = Array.from(stats.values());
    set(finalStats);

    // Asynchronously fetch additional info and finalize total volume count
    finalStats.forEach(async stat => {
      const remoteSourceUrl = Object.keys($volumes).find(k => k.startsWith('http') && normalizeTitle(k.split('/')[k.split('/').length - 2]) === stat.normalizedTitle)?.split('/').slice(0, -2).join('/');
      
      if (remoteSourceUrl) {
          const remoteVolumes = await fetchServerVolumeList(remoteSourceUrl, stat.displayTitle);
          // Use the MAX count between local and remote
          stat.totalVolumes = Math.max(stat.totalVolumes, remoteVolumes.length);

           if (!stat.coverArtUrl) {
              const { coverArt } = await fetchServerMangaInfo(remoteSourceUrl, stat.displayTitle);
              stat.coverArtUrl = coverArt;
           }
      }
      set([...finalStats]);
    });

  });

  function formatDate(timestamp: number): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

</script>

<svelte:head>
  <title>Mokuro - Stats</title>
</svelte:head>

<div class="p-2">
  <h1 class="text-2xl font-bold mb-6 text-center">Reading Statistics</h1>

  {#if !$aggregatedStats}
    <Loader>Calculating stats...</Loader>
  {:else if $aggregatedStats.length === 0}
    <div class="text-center p-20 text-gray-500">
      <p>No reading statistics yet.</p>
      <p>Start reading to see your progress here.</p>
    </div>
  {:else}
    <div class="flex flex-col gap-4 max-w-4xl mx-auto">
      {#each $aggregatedStats.sort((a, b) => b.lastRead - a.lastRead) as stat (stat.normalizedTitle)}
        <div class="bg-gray-800 rounded-lg p-4 flex items-start gap-4 shadow-lg">
          <div class="flex-shrink-0">
            {#if stat.coverArtUrl}
              <img src={stat.coverArtUrl} alt="Cover for {stat.displayTitle}" class="w-28 h-42 object-cover rounded shadow-md">
            {:else}
              <div class="w-28 h-42 bg-gray-700 rounded animate-pulse"></div>
            {/if}
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-xl font-semibold text-white truncate" title={stat.displayTitle}>{stat.displayTitle}</h2>
            <p class="text-xs text-gray-400 mb-3">Last Read: {formatDate(stat.lastRead)}</p>

            <div>
              <div class="mb-4">
                <div class="flex justify-between mb-1">
                  <span class="text-base font-medium text-gray-300">Volumes Read</span>
                  <span class="text-sm font-medium text-gray-300">{stat.volumesRead} / {stat.totalVolumes > 0 ? stat.totalVolumes : '?'}</span>
                </div>
                {#if stat.totalVolumes > 0}
                    <Progressbar value={((stat.volumesRead / stat.totalVolumes) * 100).toString()} />
                {/if}
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mt-4">
                  <div class="bg-gray-700 p-2 rounded text-center">
                      <p class="font-bold text-white text-lg">{stat.pagesRead.toLocaleString()}</p>
                      <p class="text-gray-400 text-xs">Pages</p>
                  </div>
                   <div class="bg-gray-700 p-2 rounded text-center">
                      <p class="font-bold text-white text-lg">{stat.charsRead.toLocaleString()}</p>
                      <p class="text-gray-400 text-xs">Characters</p>
                  </div>
                   <div class="bg-gray-700 p-2 rounded text-center">
                      <p class="font-bold text-white text-lg">{stat.minutesRead.toLocaleString()}</p>
                      <p class="text-gray-400 text-xs">Minutes</p>
                  </div>
                   <div class="bg-gray-700 p-2 rounded text-center">
                      <p class="font-bold text-white text-lg">{(stat.minutesRead / stat.pagesRead || 0).toFixed(2)}</p>
                      <p class="text-gray-400 text-xs">Min / Page</p>
                  </div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>