<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { goto } from '$app/navigation';
	import VolumeItem from '$lib/components/VolumeItem.svelte';
	import { Button, Listgroup, ListgroupItem } from 'flowbite-svelte';
	import { db } from '$lib/catalog/db';
	import { promptConfirmation, zipManga } from '$lib/util';
	import { page } from '$app/stores';
	import type { Volume } from '$lib/types';
	import { deleteVolume, mangaStats, volumes } from '$lib/settings';
	import { fetchServerVolumeList } from '$lib/catalog/server';
	import { miscSettings } from '$lib/settings';
	import Loader from '$lib/components/Loader.svelte';
	import { onMount } from 'svelte';

	// --- Component State ---
	let serverVolumes: string[] | null = null;
	let isLoading = true;
	let error: string | null = null;
	const source = $page.url.searchParams.get('source');
	const mangaName = $page.params.manga;

	// --- Lifecycle ---
	onMount(() => {
		if (source === 'server') {
			loadServerVolumes();
		} else {
			isLoading = false; // Local data is handled by reactive $:manga
		}
	});

	// --- Data Fetching ---
	async function loadServerVolumes() {
		isLoading = true;
		error = null;
		try {
			serverVolumes = await fetchServerVolumeList($miscSettings.serverUrl, mangaName);
		} catch (e: any) {
			error = e.message || 'Failed to load volumes.';
		} finally {
			isLoading = false;
		}
	}

	// --- Local Catalog Logic ---
	function sortManga(a: Volume, b: Volume) {
		return a.mokuroData.volume.localeCompare(b.mokuroData.volume, undefined, {
			numeric: true,
			sensitivity: 'base'
		});
	}
	$: manga = $catalog?.find((item) => item.id === $page.params.manga)?.manga.sort(sortManga);

	// --- Deletion Logic for Local Manga ---
	async function confirmDelete() {
		const title = manga?.[0].mokuroData.title_uuid;
		manga?.forEach((vol) => {
			const volId = vol.mokuroData.volume_uuid;
			deleteVolume(volId);
		});
		await db.catalog.delete(title);
		goto('/');
	}
	function onDelete() {
		promptConfirmation('Are you sure you want to delete this manga?', confirmDelete);
	}

	// --- Extraction Logic for Local Manga ---
	let extracting = false;
	async function onExtract() {
		if (manga) {
			extracting = true;
			extracting = await zipManga(manga);
		}
	}
</script>

<svelte:head>
	<title>{decodeURIComponent(mangaName)}</title>
</svelte:head>

{#if isLoading}
	<Loader>Loading volumes...</Loader>
{:else if error}
	<div class="text-center p-16 text-red-400">{error}</div>
{:else if source === 'server'}
	<div class="p-2 flex flex-col gap-5">
		<h3 class="font-bold">{decodeURIComponent(mangaName)}</h3>
		{#if serverVolumes && serverVolumes.length > 0}
			<Listgroup active class="flex-1 h-full w-full">
				{#each serverVolumes as volumeName (volumeName)}
					{@const uniqueVolumeId = `${$miscSettings.serverUrl}/${mangaName}/${volumeName}`}
					{@const progress = $volumes[uniqueVolumeId]?.progress}
					<ListgroupItem>
						<a
							href={`/${encodeURIComponent(mangaName)}/${encodeURIComponent(
								volumeName
							)}?source=server`}
							class="w-full flex justify-between items-center"
						>
							<span>{volumeName}</span>
							{#if progress > 0}
								<span class="text-sm text-gray-500 dark:text-gray-400">Page {progress}</span>
							{/if}
						</a>
					</ListgroupItem>
				{/each}
			</Listgroup>
		{:else}
			<div class="text-center p-16">No volumes found on the server for this manga.</div>
		{/if}
	</div>
{:else if manga && $mangaStats}
	<div class="p-2 flex flex-col gap-5">
		<div class="flex flex-row justify-between">
			<div class="flex flex-col gap-2">
				<h3 class="font-bold">{manga[0].mokuroData.title}</h3>
				<div class="flex flex-col gap-0 sm:flex-row sm:gap-5">
					<p>Volumes: {$mangaStats.completed} / {manga.length}</p>
					<p>Characters read: {$mangaStats.chars}</p>
					<p>Minutes read: {$mangaStats.timeReadInMinutes}</p>
				</div>
			</div>

			<div class="sm:block flex-col flex gap-2">
				<Button color="alternative" on:click={onDelete}>Remove manga</Button>
				<Button color="light" on:click={onExtract} disabled={extracting}>
					{extracting ? 'Extracting...' : 'Extract manga'}
				</Button>
			</div>
		</div>
		<Listgroup active class="flex-1 h-full w-full">
			{#each manga as volume (volume.mokuroData.volume_uuid)}
				<VolumeItem {volume} />
			{/each}
		</Listgroup>
	</div>
{:else}
	<div class="flex justify-center p-16">Manga not found</div>
{/if}