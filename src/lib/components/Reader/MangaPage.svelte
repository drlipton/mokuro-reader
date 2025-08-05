<script lang="ts">
	import type { Page } from '$lib/types';
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	import TextBoxes from './TextBoxes.svelte';
	import { settings } from '$lib/settings';
	import { Spinner } from 'flowbite-svelte';

	export let page: Page;
	export let src: File | string;
	export let isVertical = false;
	export let pageHalf: 'left' | 'right' | undefined = undefined;

	const dispatch = createEventDispatcher();
	let loading = true;
	let containerEl: HTMLDivElement;
	let canvasEl: HTMLCanvasElement;
	let sourceFile: File | Blob | null = null;
	let isDestroyed = false;
	let processedImage: HTMLImageElement | null = null;

	// State for crop offsets and new dimensions
	let cropOffsetX = 0;
	let cropOffsetY = 0;
	let croppedWidth = page.img_width;
	let croppedHeight = page.img_height;

	// State for positioning text boxes
	let scaleFactor = 1;
	let containerImageOffsetX = 0;
	let containerImageOffsetY = 0;

	$: if (!loading && canvasEl && processedImage) {
		renderCanvas(processedImage);
		calculateScaleAndOffset();
	}

	function calculateScaleAndOffset() {
		if (!canvasEl || !containerEl || !croppedWidth || !croppedHeight) return;

		const containerAspectRatio = containerEl.clientWidth / containerEl.clientHeight;
		const imageAspectRatio = croppedWidth / croppedHeight;

		let renderedWidth;
		let renderedHeight;

		if (imageAspectRatio > containerAspectRatio) {
			renderedWidth = containerEl.clientWidth;
			renderedHeight = renderedWidth / imageAspectRatio;
		} else {
			renderedHeight = containerEl.clientHeight;
			renderedWidth = renderedHeight * imageAspectRatio;
		}

		scaleFactor = renderedWidth / croppedWidth;
		containerImageOffsetX = (containerEl.clientWidth - renderedWidth) / 2;
		containerImageOffsetY = (containerEl.clientHeight - renderedHeight) / 2;
	}

	onMount(() => {
		const process = async () => {
			if (src) {
				await handleSource();
			}
		};
		setTimeout(process, 0);

		return () => {
			isDestroyed = true;
		};
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
		let blobToProcess = file;
		if (pageHalf) {
			const image = new Image();
			const objectUrl = URL.createObjectURL(file);
			const splitBlob = await new Promise<Blob | null>((resolve) => {
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

		const finalImage = new Image();
		const finalUrl = URL.createObjectURL(finalBlob);
		finalImage.onload = async () => {
			URL.revokeObjectURL(finalUrl);
			if (isDestroyed) return;
			
			croppedWidth = finalImage.width;
			croppedHeight = finalImage.height;
			processedImage = finalImage;
			loading = false;
			await tick();
			dispatch('loadcomplete');
		};
		finalImage.onerror = () => {
			URL.revokeObjectURL(finalUrl);
			if (isDestroyed) return;
			loading = false;
			dispatch('loadcomplete');
		};
		finalImage.src = finalUrl;
	}

	function renderCanvas(image: HTMLImageElement) {
		if (!canvasEl) return;
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

</script>

<div
	bind:this={containerEl}
	on:resize={calculateScaleAndOffset}
	draggable="false"
	class="page-container"
>
	{#if loading}
        <div class="w-full h-full flex items-center justify-center bg-gray-800">
            <Spinner />
        </div>
    {:else}
		<canvas
			bind:this={canvasEl}
			class="page"
		/>
		{#if !loading && sourceFile && page.blocks}
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
	{/if}
</div>

<style>
	.page-container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.page {
		display: block;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
</style>