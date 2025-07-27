<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { Button, Search, Listgroup, ButtonGroup, ListgroupItem } from 'flowbite-svelte';
	import CatalogItem from './CatalogItem.svelte';
	import Loader from './Loader.svelte';
	import { GridOutline, SortOutline, ListOutline } from 'flowbite-svelte-icons';
	import { miscSettings, updateMiscSetting } from '$lib/settings';
	import CatalogListItem from './CatalogListItem.svelte';
	import { fetchServerMangaList, fetchServerMangaInfo } from '$lib/catalog/server';
	import { onMount } from 'svelte';

	// --- Component State ---
	let search = '';
	let serverMangaList: { name: string; coverArt?: string; volumeCount?: number }[] | null = null;
	let isLoadingServerList = false;
	let serverError: string | null = null;

	// --- Reactive Logic ---
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

	$: filteredServerManga = (serverMangaList || []).filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

	// --- Data Fetching ---
	async function loadServerManga() {
		if ($miscSettings.source === 'server' && $miscSettings.serverUrl) {
			isLoadingServerList = true;
			serverError = null;
			serverMangaList = null;
			try {
				const mangaNames = await fetchServerMangaList($miscSettings.serverUrl);
				serverMangaList = mangaNames.map(name => ({ name }));

				// Asynchronously load cover art and volume counts with failure threshold
				let consecutiveFailures = 0;
				const failureThreshold = 3;

				for (const manga of serverMangaList) {
					if (consecutiveFailures >= failureThreshold) {
						console.warn('Aborting cover art fetch due to multiple consecutive failures.');
						break; // Stop fetching more covers
					}

					const info = await fetchServerMangaInfo($miscSettings.serverUrl, manga.name);
					if (!info.coverArt) {
						consecutiveFailures++;
					} else {
						consecutiveFailures = 0; // Reset on success
					}
					manga.coverArt = info.coverArt;
					manga.volumeCount = info.volumeCount;
					serverMangaList = serverMangaList; // Trigger reactivity
				}

			} catch (error: any) {
				serverError = error.message || 'Failed to load manga from server.';
			} finally {
				isLoadingServerList = false;
			}
		}
	}

	// --- UI Logic ---
	function onLayout() {
		updateMiscSetting('galleryLayout', $miscSettings.galleryLayout === 'list' ? 'grid' : 'list');
	}
	function onOrder() {
		updateMiscSetting('gallerySorting', $miscSettings.gallerySorting === 'ASC' ? 'DESC' : 'ASC');
	}

	// --- Lifecycle ---
	onMount(() => {
		if ($miscSettings.source === 'server') {
			loadServerManga();
		}
	});

	$: if ($miscSettings.source === 'server' && !serverMangaList && !isLoadingServerList) {
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

	{#if $miscSettings.source === 'local'}
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
	{:else if $miscSettings.source === 'server'}
		<div class="p-2">
			{#if isLoadingServerList && !serverMangaList}
				<Loader>Fetching manga list from server...</Loader>
			{:else if serverError}
				<div class="text-center p-10 text-red-400">
					<p>Error loading server catalog:</p>
					<p>{serverError}</p>
				</div>
			{:else if serverMangaList && serverMangaList.length > 0}
				<div class="flex sm:flex-row flex-col gap-5 flex-wrap justify-center sm:justify-start">
					{#if $miscSettings.galleryLayout === 'grid'}
						{#each filteredServerManga as { name, coverArt, volumeCount } (name)}
							<CatalogItem id={name} isRemote={true} remoteCoverUrl={coverArt} {volumeCount} />
						{/each}
					{:else}
						<Listgroup active class="w-full">
							{#each filteredServerManga as { name, coverArt, volumeCount } (name)}
								<CatalogListItem id={name} isRemote={true} remoteCoverUrl={coverArt} {volumeCount} />
							{/each}
						</Listgroup>
					{/if}
				</div>
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