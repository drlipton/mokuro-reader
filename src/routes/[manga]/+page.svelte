<script lang="ts">
	import { catalog } from '$lib/catalog';
	import { goto } from '$app/navigation';
	import VolumeItem from '$lib/components/VolumeItem.svelte';
	import { Button, Listgroup, ListgroupItem, Spinner } from 'flowbite-svelte';
	import { db } from '$lib/catalog/db';
	import { promptConfirmation, zipManga, showSnackbar } from '$lib/util';
	import { page } from '$app/stores';
	import type { Volume, MokuroData } from '$lib/types';
	import { deleteVolume, mangaStats, volumes } from '$lib/settings';
	import { fetchServerVolumeList, getProxyUrl } from '$lib/catalog/server';
	import { miscSettings } from '$lib/settings';
	import Loader from '$lib/components/Loader.svelte';
	import { onMount } from 'svelte';
	import { derived } from 'svelte/store';
	import { CheckCircleSolid, ArrowDownToBracketOutline } from 'flowbite-svelte-icons';
	import { processFiles } from '$lib/upload';

	// --- Component State ---
	let serverVolumes: string[] | null = null;
	let isLoading = true;
	let error: string | null = null;
	const source = $page.url.searchParams.get('source');
	const mangaName = $page.params.manga;
	let downloading: { [key: string]: boolean } = {};
	let extracting = false;

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

	// --- Download Logic with Retry using XMLHttpRequest ---
	function downloadFileAsBlob(url: string): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('GET', url);
			xhr.responseType = 'blob';
			xhr.onload = () => {
				if (xhr.status === 200) {
					resolve(xhr.response);
				} else {
					reject(new Error(`Download failed: Status ${xhr.status}`));
				}
			};
			xhr.onerror = () => reject(new Error('Download failed: Network error.'));
			xhr.onabort = () => reject(new Error('Download aborted.'));
			xhr.send();
		});
	}

	async function downloadWithRetry(url: string, retries = 3, delay = 1000): Promise<Blob> {
		for (let i = 0; i < retries; i++) {
			try {
				const blob = await downloadFileAsBlob(url);
				return blob;
			} catch (error) {
				console.warn(`Attempt ${i + 1} failed for ${url}:`, error);
			}
			if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
		}
		throw new Error(`Failed to download ${url} after ${retries} attempts.`);
	}

	async function downloadVolume(volumeName: string) {
		downloading[volumeName] = true;

		try {
			const serverUrl = $miscSettings.serverUrl.replace(/\/$/, '');
			const encodedManga = encodeURIComponent(mangaName);
			const encodedVolume = encodeURIComponent(volumeName);

			const mokuroUrl = `${serverUrl}/${encodedManga}/${encodedVolume}.mokuro`;
			const mokuroBlob = await downloadWithRetry(getProxyUrl(mokuroUrl));
			const mokuroData: MokuroData = JSON.parse(await mokuroBlob.text());

			const mokuroFile = new File([mokuroBlob], `${volumeName}.mokuro`);
			Object.defineProperty(mokuroFile, 'webkitRelativePath', {
				value: `${mangaName}/${volumeName}.mokuro`
			});

			const imageBaseUrl = `${serverUrl}/${encodedManga}/${encodedVolume}`;
			const imagePromises = mokuroData.pages.map(async (page) => {
				const imageUrl = `${imageBaseUrl}/${page.img_path}`;
				const imageBlob = await downloadWithRetry(getProxyUrl(imageUrl));
				const imageFile = new File([imageBlob], page.img_path);
				Object.defineProperty(imageFile, 'webkitRelativePath', {
					value: `${mangaName}/${volumeName}/${page.img_path}`
				});
				return imageFile;
			});

			const imageFiles = await Promise.all(imagePromises);

			await processFiles([mokuroFile, ...imageFiles]);

			showSnackbar(`${volumeName} added to local library!`);
		} catch (err: any) {
			console.error(err);
			showSnackbar(`Failed to download ${volumeName}: ${err.message}`);
		} finally {
			downloading[volumeName] = false;
		}
	}

	// --- Derived State for UI ---
	const remoteMangaStats = derived(volumes, ($volumes) => {
		if (source !== 'server' || !serverVolumes) {
			return { completed: 0, chars: 0, timeReadInMinutes: 0 };
		}
		return serverVolumes.reduce((stats, volumeName) => {
			const uniqueVolumeId = `${$miscSettings.serverUrl}/${mangaName}/${volumeName}`;
			const volData = $volumes[uniqueVolumeId];
			if (volData) {
				if (volData.completed) stats.completed++;
				stats.chars += volData.chars || 0;
				stats.timeReadInMinutes += volData.timeReadInMinutes || 0;
			}
			return stats;
		}, { completed: 0, chars: 0, timeReadInMinutes: 0 });
	});
	
	const localMangaTitles = derived(catalog, ($catalog) => {
		const titles = new Map<string, Set<string>>();
		if (!$catalog) return titles;

		for (const manga of $catalog) {
			const volumeNames = new Set(manga.manga.map(v => v.volumeName));
			titles.set(manga.id, volumeNames);
		}
		return titles;
	});

	$: manga = $catalog?.find((item) => item.id === $page.params.manga)?.manga.sort((a, b) => 
		a.mokuroData.volume.localeCompare(b.mokuroData.volume, undefined, { numeric: true, sensitivity: 'base' })
	);
</script>

<svelte:head>
	<title>{decodeURIComponent(mangaName)}</title>
</svelte:head>

{#if isLoading}
	<Loader>Loading volumes...</Loader>
{:else if error}
	<div class="text-center p-16 text-red-400">{error}</div>
{:else if source === 'server' && $remoteMangaStats}
	<div class="p-2 flex flex-col gap-5">
		<h3 class="font-bold">{decodeURIComponent(mangaName)}</h3>
		<div class="flex flex-col gap-0 sm:flex-row sm:gap-5">
			<p>Volumes: {$remoteMangaStats.completed} / {serverVolumes?.length || 0}</p>
			<p>Characters read: {$remoteMangaStats.chars}</p>
			<p>Minutes read: {$remoteMangaStats.timeReadInMinutes}</p>
		</div>
		{#if serverVolumes && serverVolumes.length > 0}
			<Listgroup active class="flex-1 h-full w-full">
				{#each serverVolumes as volumeName (volumeName)}
					{@const uniqueVolumeId = `${$miscSettings.serverUrl}/${mangaName}/${volumeName}`}
					{@const progress = $volumes[uniqueVolumeId]?.progress}
					{@const totalPages = $volumes[uniqueVolumeId]?.totalPages || 0}
                    {@const isComplete = $volumes[uniqueVolumeId]?.completed}
					{@const isLocal = $localMangaTitles.get(mangaName)?.has(volumeName)}
					<ListgroupItem class="flex items-center gap-4">
						<a
							href={`/${encodeURIComponent(mangaName)}/${encodeURIComponent(
								volumeName
							)}?source=server`}
							class="w-full flex justify-between items-center"
						>
							<span>{volumeName}</span>
							<div class="flex items-center gap-2">
								{#if progress > 0}
									<span class="text-sm text-gray-500 dark:text-gray-400">Page {progress} / {totalPages}</span>
								{:else if totalPages > 0}
									<span class="text-sm text-gray-500 dark:text-gray-400">{totalPages} pages</span>
								{/if}
								{#if isComplete}
									<CheckCircleSolid class="text-green-400" />
								{/if}
							</div>
						</a>
						<button
							disabled={isLocal || downloading[volumeName]}
							on:click={() => downloadVolume(volumeName)}
							class="text-gray-400 disabled:text-gray-600 enabled:hover:text-primary-500"
							aria-label="Download volume"
						>
							{#if downloading[volumeName]}
								<Spinner size="4" />
							{:else}
								<ArrowDownToBracketOutline />
							{/if}
						</button>
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
				<Button color="alternative" on:click={() => promptConfirmation('Are you sure you want to delete this manga?', async () => {
					const title = manga?.[0].mokuroData.title_uuid;
					manga?.forEach((vol) => {
						const volId = vol.mokuroData.volume_uuid;
						deleteVolume(volId);
					});
					await db.catalog.delete(title);
					goto('/');
				})}>Remove manga</Button>
				<Button color="light" on:click={async () => {
					if (manga) {
						extracting = true;
						extracting = await zipManga(manga);
					}
				}} disabled={extracting}>
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