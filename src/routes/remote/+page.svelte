<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Search, Listgroup, ListgroupItem } from 'flowbite-svelte';
  import { PlusOutline, TrashBinOutline, GridOutline, ListOutline } from 'flowbite-svelte-icons';
  import ServerUrlModal from '$lib/components/ServerUrlModal.svelte';
  import CatalogItem from '$lib/components/CatalogItem.svelte';
  import CatalogListItem from '$lib/components/CatalogListItem.svelte';
  import Loader from '$lib/components/Loader.svelte';
  import { fetchServerMangaList, fetchServerMangaInfo } from '$lib/catalog/server';
  import { miscSettings, updateMiscSetting } from '$lib/settings';
  import GoogleDriveManager from '$lib/components/GoogleDriveManager.svelte';
  import { GoogleSolid } from 'flowbite-svelte-icons';

  type Source = {
    url: string;
    username?: string;
    password?: string;
  };

  let search = '';
  let serverModalOpen = false;
  let sources: Source[] = [];
  let selectedSource: Source | null = null;
  let mangaList: { name: string; coverArt?: string; volumeCount?: number }[] | null = null;
  let isLoading = false;
  let error: string | null = null;
  let currentFetchId = 0;
  let showDriveManager = false;

  onMount(() => {
    const savedSources = localStorage.getItem('remoteSources');
    if (savedSources) {
      sources = JSON.parse(savedSources);
    }
  });

  function addSource(newSource: Source) {
    if (newSource.url && !sources.find(s => s.url === newSource.url)) {
      sources = [...sources, newSource];
      localStorage.setItem('remoteSources', JSON.stringify(sources));
      selectSource(newSource);
    }
  }

  function removeSource(sourceToRemove: Source) {
    sources = sources.filter(s => s.url !== sourceToRemove.url);
    localStorage.setItem('remoteSources', JSON.stringify(sources));
    if (selectedSource?.url === sourceToRemove.url) {
      selectedSource = null;
      mangaList = null;
    }
  }

  async function selectSource(source: Source) {
    currentFetchId++;
    const thisFetchId = currentFetchId;

    selectedSource = source;
    updateMiscSetting('serverUrl', source.url);
    updateMiscSetting('serverUsername', source.username || '');
    updateMiscSetting('serverPassword', source.password || '');
    
    isLoading = true;
    error = null;
    mangaList = null;

    try {
      const mangaNames = await fetchServerMangaList(source.url);
      if (thisFetchId !== currentFetchId) return;

      let mangaItems = mangaNames.map(name => ({ name, coverArt: undefined, volumeCount: undefined }));
      mangaList = mangaItems;
      
      for (const manga of mangaItems) {
        if (thisFetchId !== currentFetchId) return;
        const info = await fetchServerMangaInfo(source.url, manga.name);
        if (thisFetchId !== currentFetchId) return;

        if (mangaList) {
            const itemInList = mangaList.find(m => m.name === manga.name);
            if(itemInList) {
              itemInList.coverArt = info.coverArt;
              itemInList.volumeCount = info.volumeCount;
              mangaList = [...mangaList];
            }
        }
      }
    } catch (err: any) {
      if (thisFetchId === currentFetchId) {
        error = err.message || 'Failed to load manga from the selected source.';
      }
    } finally {
      if (thisFetchId === currentFetchId) {
        isLoading = false;
      }
    }
  }

  function onLayout() {
    updateMiscSetting('galleryLayout', $miscSettings.galleryLayout === 'list' ? 'grid' : 'list');
  }

  $: filteredManga = (mangaList || []).filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
</script>

<svelte:head>
  <title>Mokuro - Remote</title>
</svelte:head>

<ServerUrlModal bind:open={serverModalOpen} on:save={(e) => addSource(e.detail)} />

<div class="p-2">
  <div class="flex flex-col items-center mb-8">
    <Button on:click={() => showDriveManager = !showDriveManager} color="alternative" class="w-full max-w-sm">
        <GoogleSolid class="w-5 h-5 mr-2" />
        {showDriveManager ? 'Hide' : 'Manage'} Google Drive
    </Button>
    {#if showDriveManager}
        <div class="border border-gray-700 rounded-lg p-4 mt-4 w-full max-w-2xl">
            <GoogleDriveManager />
        </div>
    {/if}
  </div>

  <div class="inline-flex items-center justify-center w-full">
    <hr class="w-full h-px my-8 bg-gray-200 border-0 dark:bg-gray-700">
    <span class="absolute px-3 font-medium text-gray-900 -translate-x-1/2 bg-white left-1/2 dark:text-white dark:bg-gray-950">OR</span>
  </div>

  <div class="flex justify-between items-center mb-4 mt-8">
    <h2 class="text-xl font-semibold">HTTP Sources</h2>
    <Button on:click={() => serverModalOpen = true} size="sm">
      <PlusOutline class="mr-2" /> Add Source
    </Button>
  </div>

  {#if sources.length > 0}
    <Listgroup class="mb-4">
      {#each sources as source (source.url)}
        <ListgroupItem 
            active={selectedSource?.url === source.url}
            class="p-0" 
        >
          <button 
              on:click={() => selectSource(source)} 
              class="w-full text-left flex justify-between items-center py-2 px-4"
          >
            <span class="truncate">{source.url}</span>
            <button 
                on:click|stopPropagation={() => removeSource(source)} 
                class="text-gray-400 hover:text-red-500 p-1 -mr-2 flex-shrink-0 ml-2 z-10"
                aria-label="Remove source"
            >
              <TrashBinOutline />
            </button>
          </button>
        </ListgroupItem>
      {/each}
    </Listgroup>
  {:else}
    <p class="text-center text-gray-500 py-8">No HTTP sources added yet.</p>
  {/if}

  {#if selectedSource}
    <div class="mt-6 flex gap-1">
      <Search bind:value={search} placeholder="Search manga..." />
      <Button size="sm" color="alternative" on:click={onLayout}>
        {#if $miscSettings.galleryLayout === 'list'}
          <GridOutline />
        {:else}
          <ListOutline />
        {/if}
      </Button>
    </div>

    {#if isLoading && !mangaList}
      <Loader>Fetching manga list...</Loader>
    {:else if error}
      <div class="text-center p-10 text-red-400">
        <p>Error: {error}</p>
      </div>
    {:else if mangaList}
        {#if filteredManga.length === 0}
            <div class="text-center p-20">
                <p>No manga found on this source.</p>
            </div>
        {:else}
            <div class="mt-4 flex sm:flex-row flex-col gap-5 flex-wrap justify-center sm:justify-start">
                {#if $miscSettings.galleryLayout === 'grid'}
                {#each filteredManga as { name, coverArt, volumeCount } (name)}
                    <CatalogItem id={name} isRemote={true} remoteCoverUrl={coverArt} {volumeCount} />
                {/each}
                {:else}
                <Listgroup active class="w-full">
                    {#each filteredManga as { name, coverArt, volumeCount } (name)}
                    <CatalogListItem id={name} isRemote={true} remoteCoverUrl={coverArt} {volumeCount} />
                    {/each}
                </Listgroup>
                {/if}
            </div>
        {/if}
    {/if}
  {/if}
</div>