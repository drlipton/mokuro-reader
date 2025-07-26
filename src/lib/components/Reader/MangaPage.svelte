 <script lang="ts">
	import type { Page } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import TextBoxes from './TextBoxes.svelte';
	import { zoomDefault } from '$lib/panzoom';
	import { settings } from '$lib/settings';
	import type { PanzoomObject } from '@panzoom/panzoom';

	export let page: Page;
	export let src: File | string;
	export let isVertical = false;

	let imageUrl: string | undefined;
	let loading = true;
	let containerEl: HTMLDivElement;
	let containerWidth: number;
	let panzoom: PanzoomObject | null = null;
	let sourceFile: File | Blob | null = null;

	// State for crop offsets and new dimensions
	let cropOffsetX = 0;
	let cropOffsetY = 0;
	let croppedWidth = page.img_width;
	let croppedHeight = page.img_height;

	onMount(() => {
		if (src) {
			handleSource();
		}
		if (containerEl) {
			panzoom = zoomDefault(containerEl);
		}
	});

	async function handleSource() {
		if (typeof src === 'string') {
			try {
				const response = await fetch(src);
				sourceFile = await response.blob();
				await updateImage(sourceFile);
			} catch (error) {
				console.error(`Failed to fetch image from URL: ${src}`, error);
				loading = false;
			}
		} else {
			sourceFile = src;
			await updateImage(sourceFile);
		}
	}

	async function updateImage(file: File | Blob) {
		console.log(`Processing page: ${page.img_path}`);
		loading = true;
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
		if ($settings.autoCrop) {
			try {
				const { cropImageBorder } = await import('$lib/util/crop');
				const { blob: croppedBlob, x, y, newWidth, newHeight } = await cropImageBorder(file);
				imageUrl = URL.createObjectURL(croppedBlob);
				cropOffsetX = x;
				cropOffsetY = y;
				croppedWidth = newWidth;
				croppedHeight = newHeight;
			} catch (error) {
				console.error('Failed to crop image, falling back to original.', error);
				imageUrl = URL.createObjectURL(file);
				resetCrop();
			}
		} else {
			imageUrl = URL.createObjectURL(file);
			resetCrop();
		}
		loading = false;
		console.log(`Finished processing page: ${page.img_path}`);
	}

	function resetCrop() {
		cropOffsetX = 0;
		cropOffsetY = 0;
		croppedWidth = page.img_width;
		croppedHeight = page.img_height;
	}

	onDestroy(() => {
		if (panzoom) {
			panzoom.destroy();
		}
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
		console.log(`Unloaded page: ${page.img_path}`);
	});

	$: aspectRatio = croppedWidth / croppedHeight;
	$: scaleFactor = isVertical ? containerWidth / croppedWidth : 1;
	$: containerImageOffsetX = isVertical ? 0 : (page.img_width - croppedWidth) / 2;
	$: containerImageOffsetY = isVertical ? 0 : (page.img_height - croppedHeight) / 2;
</script>

<div
	bind:this={containerEl}
	bind:clientWidth={containerWidth}
	draggable="false"
	class="page relative bg-contain bg-no-repeat bg-center"
	style:width={isVertical ? '100vw' : `${page.img_width}px`}
	style:height={isVertical ? `calc(100vw / ${aspectRatio})` : `${page.img_height}px`}
	style:background-image={imageUrl && !loading ? `url(${imageUrl})` : 'none'}
>
	{#if !loading && sourceFile}
		<TextBoxes
			page={page}
			src={sourceFile}
			{scaleFactor}
			{cropOffsetX}
			{cropOffsetY}
			{containerImageOffsetX}
			{containerImageOffsetY}
		/>
	{/if}
</div>

<style>
	.bg-contain {
		background-size: contain;
	}
	.bg-no-repeat {
		background-repeat: no-repeat;
	}
	.bg-center {
		background-position: center;
	}
</style>