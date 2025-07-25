<script lang="ts">
	import type { Page } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import TextBoxes from './TextBoxes.svelte';
	import { zoomDefault } from '$lib/panzoom';
	import { settings } from '$lib/settings';
	import type { PanzoomObject } from '@panzoom/panzoom';

	export let page: Page;
	export let src: File;
	export let isVertical = false;
	export let isVisible = true; // For lazy loading in vertical scroll mode

	let imageUrl: string | undefined;
	let loading = true;
	let containerEl: HTMLDivElement;
	let containerWidth: number;
	let panzoom: PanzoomObject | null = null;

	// State for crop offsets and new dimensions
	let cropOffsetX = 0;
	let cropOffsetY = 0;
	let croppedWidth = page.img_width;
	let croppedHeight = page.img_height;

	$: if (src && isVisible) {
		updateImage(src);
	}

	async function updateImage(sourceFile: File) {
		loading = true;
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
		if ($settings.autoCrop) {
			try {
				const { cropImageBorder } = await import('$lib/util/crop');
				const { blob: croppedBlob, x, y, newWidth, newHeight } = await cropImageBorder(sourceFile);
				imageUrl = URL.createObjectURL(croppedBlob);
				cropOffsetX = x;
				cropOffsetY = y;
				croppedWidth = newWidth;
				croppedHeight = newHeight;
			} catch (error) {
				console.error('Failed to crop image, falling back to original.', error);
				imageUrl = URL.createObjectURL(sourceFile);
				resetCrop();
			}
		} else {
			// If not cropping, use original image and reset offsets
			imageUrl = URL.createObjectURL(sourceFile);
			resetCrop();
		}
		loading = false;
	}

	function resetCrop() {
		cropOffsetX = 0;
		cropOffsetY = 0;
		croppedWidth = page.img_width;
		croppedHeight = page.img_height;
	}

	onMount(() => {
		if (containerEl) {
			panzoom = zoomDefault(containerEl);
		}
	});

	onDestroy(() => {
		if (panzoom) {
			panzoom.destroy();
		}
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
	});

	$: aspectRatio = croppedWidth / croppedHeight;
	$: scaleFactor = containerWidth / croppedWidth;
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
	{#if !loading && src}
		<TextBoxes {page} {src} {scaleFactor} {isVertical} {cropOffsetX} {cropOffsetY} />
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