<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { Button, Search, Listgroup, ButtonGroup, ListgroupItem } from 'flowbite-svelte';
	import CatalogItem from './CatalogItem.svelte';
	import Loader from './Loader.svelte';
	import { GridOutline, SortOutline, ListOutline } from 'flowbite-svelte-icons';
	import { miscSettings, updateMiscSetting } from '$lib/settings';
	import CatalogListItem from './CatalogListItem.svelte';
	import { fetchServerMangaList } from '$lib/catalog/server';

	// --- Local Catalog Logic ---
	$: sortedCatalog =
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

	let search = '';
	function onLayout() {
		updateMiscSetting('galleryLayout', $miscSettings.galleryLayout === 'list' ? 'grid' : 'list');
	}
	function onOrder() {
		updateMiscSetting('gallerySorting', $miscSettings.gallerySorting === 'ASC' ? 'DESC' : 'ASC');
	}

	// --- Server Catalog Logic ---
	let serverMangaList: string[] | null = null;
	let isLoadingServerList = false;
	let serverError: string | null = null;

	async function loadServerManga() {
		if ($miscSettings.source === 'server' && $miscSettings.serverUrl) {
			isLoadingServerList = true;
			serverError = null;
			serverMangaList = null;
			try {
				serverMangaList = await fetchServerMangaList($miscSettings.serverUrl);
			} catch (error: any) {
				serverError = error.message || 'Failed to load manga from server.';
			} finally {
				isLoadingServerList = false;
			}
		}
	}

	// Load server manga when the source or URL changes
	$: if ($miscSettings.source === 'server') {
		loadServerManga();
	}
</script>

<div class="flex flex-col gap-5">
	<div class="flex justify-center">
		<ButtonGroup>
			<Button
				color={$miscSettings.source === 'local' ? 'dark' : 'alternative'}
				on:click={() => updateMiscSetting('source', 'local')}
			>
				Local
			</Button>
			<Button
				color={$miscSettings.source === 'server' ? 'dark' : 'alternative'}
				on:click={() => updateMiscSetting('source', 'server')}
			>
				Server
			</Button>
		</ButtonGroup>
	</div>

	{#if $miscSettings.source === 'local'}
		{#if $catalog}
			{#if $catalog.length > 0}
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
				</div>
				{#if search && sortedCatalog.length === 0}
					<div class="text-center p-20">
						<p>No results found.</p>
					</div>
				{:else}
					<div class="flex sm:flex-row flex-col gap-5 flex-wrap justify-center sm:justify-start">
						{#if $miscSettings.galleryLayout === 'grid'}
							{#each sortedCatalog as { id } (id)}
								<CatalogItem {id} />
							{/each}
						{:else}
							<Listgroup active class="w-full">
								{#each sortedCatalog as { id } (id)}
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
	{:else if $miscSettings.source === 'server'}
		<div class="p-2">
			{#if isLoadingServerList}
				<Loader>Fetching manga list from server...</Loader>
			{:else if serverError}
				<div class="text-center p-10 text-red-400">
					<p>Error loading server catalog:</p>
					<p>{serverError}</p>
				</div>
			{:else if serverMangaList && serverMangaList.length > 0}
				<Listgroup active class="w-full">
					{#each serverMangaList as mangaName (mangaName)}
						<ListgroupItem>
							<a href={`/${encodeURIComponent(mangaName)}?source=server`} class="w-full">
								{mangaName}
							</a>
						</ListgroupItem>
					{/each}
				</Listgroup>
			{:else if serverMangaList}
				<div class="text-center p-10">
					<p>No manga found on the server.</p>
					<p class="text-gray-500">
						Ensure the server URL is correct and the directory is not empty.
					</p>
				</div>
			{:else if !$miscSettings.serverUrl}
				<div class="text-center p-10">
					<p>No server URL has been set.</p>
					<p class="mt-4 text-gray-500">
						Click the server icon in the top right to configure a manga server.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>