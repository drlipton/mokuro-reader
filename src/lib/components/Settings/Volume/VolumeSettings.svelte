<script lang="ts">
	import { page } from '$app/stores';
	import { zoomDefault } from '$lib/panzoom';
	import {
		updateProgress,
		updateVolumeSetting,
		volumes,
		volumeSettings,
		type VolumeSettingsKey,
		miscSettings
	} from '$lib/settings';
	import { AccordionItem, Helper, Toggle } from 'flowbite-svelte';

	const source = $page.url.searchParams.get('source');
	const mangaName = $page.params.manga;
	const volumeIdParam = $page.params.volume;

	// Construct the correct ID for local vs. server manga
	let uniqueVolumeId: string;
	if (source === 'server') {
		uniqueVolumeId = `${$miscSettings.serverUrl}/${mangaName}/${volumeIdParam}`;
	} else {
		uniqueVolumeId = volumeIdParam;
	}

	$: settings = $volumeSettings[uniqueVolumeId];

	$: toggles = settings
		? [
				{ key: 'rightToLeft', text: 'Right to left', value: settings.rightToLeft },
				{ key: 'singlePageView', text: 'Single page view', value: settings.singlePageView },
				{ key: 'hasCover', text: 'First page is cover', value: settings.hasCover }
		  ]
		: [];

	function onChange(key: VolumeSettingsKey, value: any) {
		updateVolumeSetting(uniqueVolumeId, key, !value);
		if (key === 'hasCover') {
			const pageClamped = Math.max($volumes[uniqueVolumeId].progress - 1, 1);
			updateProgress(uniqueVolumeId, pageClamped);
			zoomDefault();
		}
	}
</script>

<AccordionItem open>
	<span slot="header">Volume settings</span>
	{#if settings}
		<div class="flex flex-col gap-5">
			<Helper>These settings only apply to this volume</Helper>
			{#each toggles as { key, text, value }}
				<Toggle size="small" checked={value} on:change={() => onChange(key, value)}>{text}</Toggle>
			{/each}
		</div>
	{:else}
		<div class="p-4 text-sm text-gray-500 dark:text-gray-400">
			Loading volume settings...
		</div>
	{/if}
</AccordionItem>