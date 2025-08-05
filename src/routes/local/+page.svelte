<script lang="ts">
  import { catalog } from '$lib/catalog';
  import CatalogItem from '$lib/components/CatalogItem.svelte';
  import CatalogListItem from '$lib/components/CatalogListItem.svelte';
  import Loader from '$lib/components/Loader.svelte';
  import UploadModal from '$lib/components/UploadModal.svelte';
  import { miscSettings, updateMiscSetting } from '$lib/settings';
  import { Button, Listgroup, Search } from 'flowbite-svelte';
  import { GridOutline, ListOutline, SortOutline, UploadOutline } from 'flowbite-svelte-icons';

  let search = '';
  let uploadModalOpen = false;

  $: filteredLocalCatalog =
    $catalog
      ?.sort((a, b) => {
        if ($miscSettings.gallerySorting === 'ASC') {
          return a.manga[0].mokuroData.title.localeCompare(b.manga[0].mokuroData.title);
        } else {
          return b.manga[0].mokuroData.title.localeCompare(a.manga[0].mokuroData.title);
        }
      })
      .filter((item) => {
        return item.manga[0].mokuroData.title.toLowerCase().indexOf(search.toLowerCase()) !== -1;
      }) || [];

  function onLayout() {
    updateMiscSetting('galleryLayout', $miscSettings.galleryLayout === 'list' ? 'grid' : 'list');
  }
  function onOrder() {
    updateMiscSetting('gallerySorting', $miscSettings.gallerySorting === 'ASC' ? 'DESC' : 'ASC');
  }
</script>

<svelte:head>
  <title>Mokuro - Local</title>
</svelte:head>

<UploadModal bind:open={uploadModalOpen} />

<div class="flex flex-col gap-5">
  <div class="flex gap-1 py-2">
    <Search bind:value={search} />
    <Button size="sm" color="alternative" on:click={onLayout}>
      {#if $miscSettings.galleryLayout === 'list'}
        <GridOutline />
      {:else}
        <ListOutline />
      {/if}
    </Button>
    <Button size="sm" color="alternative" on:click={onOrder}>
      <SortOutline />
    </Button>
    <Button size="sm" color="alternative" on:click={() => (uploadModalOpen = true)}>
      <UploadOutline />
    </Button>
  </div>

  {#if $catalog}
    {#if $catalog.length > 0}
      {#if search && filteredLocalCatalog.length === 0}
        <div class="text-center p-20">
          <p>No results found.</p>
        </div>
      {:else}
        <div class="flex sm:flex-row flex-col gap-5 flex-wrap justify-center sm:justify-start">
          {#if $miscSettings.galleryLayout === 'grid'}
            {#each filteredLocalCatalog as { id } (id)}
              <CatalogItem {id} />
            {/each}
          {:else}
            <Listgroup active class="w-full">
              {#each filteredLocalCatalog as { id } (id)}
                <CatalogListItem {id} />
              {/each}
            </Listgroup>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="text-center p-20">
        <p>Your local catalog is currently empty.</p>
      </div>
    {/if}
  {:else}
    <Loader>Fetching local catalog...</Loader>
  {/if}
</div>