<script lang="ts">
	import type { Page } from '$lib/types';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import TextBoxes from './TextBoxes.svelte';
	import { zoomDefault } from '$lib/panzoom';
	import { settings } from '$lib/settings';
	import type { PanzoomObject } from '@panzoom/panzoom';

	export let page: Page;
	export let src: File | string;
	export let isVertical = false;
	export let pageHalf: 'left' | 'right' | undefined = undefined;

	const dispatch = createEventDispatcher();

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
		dispatch('loadcomplete');
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

	$: effectiveWidth = pageHalf ? croppedWidth / 2 : croppedWidth;
	$: aspectRatio = effectiveWidth / croppedHeight;
	$: scaleFactor = isVertical ? containerWidth / effectiveWidth : 1;
	$: containerImageOffsetX = 0;
	$: containerImageOffsetY = 0;
</script>

<div
	bind:this={containerEl}
	bind:clientWidth={containerWidth}
	draggable="false"
	class="page relative bg-no-repeat"
	style:width={isVertical ? '100vw' : `${effectiveWidth}px`}
	style:height={isVertical ? `calc(100vw / ${aspectRatio})` : `${croppedHeight}px`}
	style:background-image={imageUrl && !loading ? `url(${imageUrl})` : 'none'}
	style:background-position={pageHalf === 'right' ? '100% 0%' : pageHalf === 'left' ? '0% 0%' : 'center'}
	style:background-size={pageHalf ? '200% 100%' : 'contain'}
>
	{#if !loading && sourceFile}
		<TextBoxes
			{page}
			src={sourceFile}
			{scaleFactor}
			{cropOffsetX}
			{cropOffsetY}
			{containerImageOffsetX}
			{containerImageOffsetY}
			{pageHalf}
		/>
	{/if}
</div>

<style>
	.bg-no-repeat {
		background-repeat: no-repeat;
	}
</style>