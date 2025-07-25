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

	let imageUrl: string | undefined;
	let loading = true;
	let containerEl: HTMLDivElement;
	let containerWidth: number;
	let panzoom: PanzoomObject | null = null;
	// Add state for crop offsets
	let cropOffsetX = 0;
	let cropOffsetY = 0;

	$: if (src) {
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
				// Destructure the blob and the new x, y offsets
				const { blob: croppedBlob, x, y } = await cropImageBorder(sourceFile);
				imageUrl = URL.createObjectURL(croppedBlob);
				cropOffsetX = x;
				cropOffsetY = y;
			} catch (error) {
				console.error('Failed to crop image, falling back to original.', error);
				imageUrl = URL.createObjectURL(sourceFile);
				cropOffsetX = 0;
				cropOffsetY = 0;
			}
		} else {
			// If not cropping, use original image and reset offsets
			imageUrl = URL.createObjectURL(sourceFile);
			cropOffsetX = 0;
			cropOffsetY = 0;
		}
		loading = false;
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

	$: aspectRatio = page.img_width / page.img_height;
	$: scaleFactor = containerWidth / page.img_width;
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