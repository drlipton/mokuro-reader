<script lang="ts">
	import type { Page } from '$lib/types';
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	import TextBoxes from './TextBoxes.svelte';
	import { zoomDefault } from '$lib/panzoom';
	import { settings } from '$lib/settings';
	import type { PanzoomObject } from '@panzoom/panzoom';

	export let page: Page;
	export let src: File | string;
	export let isVertical = false;
	export let pageHalf: 'left' | 'right' | undefined = undefined;

	const dispatch = createEventDispatcher();
	let loading = true;
	let containerEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let containerWidth: number;
	let panzoom: PanzoomObject | null = null;
	let sourceFile: File | Blob | null = null;
	let isDestroyed = false;
	// Flag to track component lifecycle

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
	onDestroy(() => {
		isDestroyed = true; // Set the flag when component is destroyed
		if (panzoom) {
			panzoom.destroy();
		}
		console.log(`Unloaded page: ${page.img_path}`);
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
		// Step 1: Create a blob for the correct half of the page if necessary
		let blobToProcess = file;
		if (pageHalf) {
			const image = new Image();
			const objectUrl = URL.createObjectURL(file);
			const splitBlob = await new Promise<Blob |
			null>((resolve) => {
				image.onload = () => {
					URL.revokeObjectURL(objectUrl);
					if (isDestroyed) return resolve(null);
					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d');
					if (!ctx) {
						resolve(null);
						return;
					}
					canvas.width = image.width / 2;
					canvas.height = image.height;
					const sx = pageHalf === 'left' ? 0 : image.width / 2;
					ctx.drawImage(
						image,
						sx,
						0,
						image.width / 2,
						image.height,
						0,
						0,
						image.width / 2,
						image.height
					);
					canvas.toBlob(resolve, file.type);
				};
				image.onerror = () => {
					URL.revokeObjectURL(objectUrl);
					resolve(null);
				};
				image.src = objectUrl;
			});
			if (splitBlob) {
				blobToProcess = splitBlob;
			}
		}

		// Step 2: Crop the blob if autoCrop is enabled
		let finalBlob = blobToProcess;
		if ($settings.autoCrop) {
			try {
				const { cropImageBorder } = await import('$lib/util/crop');
				const result = await cropImageBorder(blobToProcess);
				finalBlob = result.blob;
				cropOffsetX = result.x;
				cropOffsetY = result.y;
			} catch (e) {
				console.error('Failed to crop image, falling back.', e);
				resetCrop();
			}
		} else {
			resetCrop();
		}

		// Step 3: Render the final blob to the canvas
		const finalImage = new Image();
		const finalUrl = URL.createObjectURL(finalBlob);
		finalImage.onload = async () => {
			URL.revokeObjectURL(finalUrl);
			if (isDestroyed) return;
			
			croppedWidth = finalImage.width;
			croppedHeight = finalImage.height;
            await tick(); // Wait for svelte to bind the canvas element
			renderCanvas(finalImage);
			loading = false;
			await tick();
			// Ensure DOM is updated with new dimensions
			dispatch('loadcomplete');
			console.log(`Finished processing page: ${page.img_path}`);
		};
		finalImage.onerror = () => {
			URL.revokeObjectURL(finalUrl);
			if (isDestroyed) return;
			loading = false;
			dispatch('loadcomplete'); // Dispatch even on error to unblock reader
		};
		finalImage.src = finalUrl;
	}

	function renderCanvas(image: HTMLImageElement) {
		if (!canvasEl) {
            console.warn(`renderCanvas called for ${page.img_path}, but canvas element was not ready.`);
            return;
        };
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		canvasEl.width = image.width * dpr;
		canvasEl.height = image.height * dpr;
		ctx.scale(dpr, dpr);
		ctx.drawImage(image, 0, 0, image.width, image.height);
	}

	function resetCrop() {
		cropOffsetX = 0;
		cropOffsetY = 0;
		croppedWidth = page.img_width;
		croppedHeight = page.img_height;
	}

	$: effectiveWidth = pageHalf ? croppedWidth / 2 : croppedWidth;
	$: aspectRatio = croppedHeight > 0 ? croppedWidth / croppedHeight : 1;
	$: scaleFactor = isVertical ? containerWidth / croppedWidth : 1;
	$: containerImageOffsetX = 0;
	$: containerImageOffsetY = 0;
</script>

<div
	bind:this={containerEl}
	bind:clientWidth={containerWidth}
	draggable="false"
	class="page-container relative"
	style:width={isVertical ? '100vw' : `${croppedWidth}px`}
	style:height={isVertical ? `calc(100vw / ${aspectRatio})` : `${croppedHeight}px`}
>
	<canvas
		bind:this={canvasEl}
		class="page"
		style:width={isVertical ? '100vw' : `${croppedWidth}px`}
		style:height={isVertical ? `calc(100vw / ${aspectRatio})` : `${croppedHeight}px`}
	/>
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
	.page {
		display: block;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.page-container {
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>