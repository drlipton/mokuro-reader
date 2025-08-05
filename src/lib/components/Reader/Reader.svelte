<script lang="ts">
	import {
		Panzoom,
		panzoomStore,
		toggleFullScreen,
		zoomDefault,
		zoomFitToScreen
	} from '$lib/panzoom';
	import { progress, settings, updateProgress, type VolumeSettings } from '$lib/settings';
	import { clamp, debounce, fireExstaticEvent } from '$lib/util';
	import MangaPage from './MangaPage.svelte';
	import Cropper from './Cropper.svelte';
	import { beforeNavigate } from '$app/navigation';
	import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
	import type { Page, Volume } from '$lib/types';
	import ReaderControls from './ReaderControls.svelte';
	import { getCharCount } from '$lib/util/count-chars';
	import { Spinner } from 'flowbite-svelte';
	import { page as pageStore } from '$app/stores';

	// ----------------- Props -----------------
	export let loadedVolume: Volume;
	export let volumeSettings: VolumeSettings;

	// ----------------- Component State -----------------
	let start: Date;
	let startX = 0;
	let startY = 0;
	let touchStart: Date;

	let observer: IntersectionObserver;
	let verticalScrollingInitialized = false;
	let initialScrollDone = false;

	let pageVisibility: boolean[] = [];
	let controlsVisible = true;
	let controlsTimeout: ReturnType<typeof setTimeout>;
	let pagesToLoad = 0;

	// ----------------- Derived State -----------------
	$: hasMokuro = !!loadedVolume?.mokuroData;

	// FIX: This logic now safely handles both mokuro and image-only volumes.
	$: pages = (() => {
		if (hasMokuro && loadedVolume.mokuroData) {
			const originalPages = loadedVolume.mokuroData.pages || [];
			if (!$settings.splitDoublePages) return originalPages;
			
			return originalPages.flatMap((p) => {
				if (p.img_width > p.img_height) {
					const leftPage = { ...p, split: 'left' as const };
					const rightPage = { ...p, split: 'right' as const };
					return volumeSettings.rightToLeft ? [rightPage, leftPage] : [leftPage, rightPage];
				}
				return p;
			});
		}
		// Fallback for image-only volumes (local or remote)
		if (loadedVolume?.files) {
			return Object.keys(loadedVolume.files)
				.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
				.map(fileName => ({
					img_path: fileName,
					blocks: [],
					img_height: 0,
					img_width: 0,
					version: '',
				} as Page));
		}
		return [];
	})();
	
	$: originalPages = loadedVolume?.mokuroData?.pages || [];
	$: uniqueVolumeId = loadedVolume?.mokuroData?.volume_uuid || `${$pageStore.url.pathname}`;
	$: page = ($progress?.[uniqueVolumeId] as number) || 1;
	$: index = Math.max(0, Math.min(page - 1, Math.max(0, (pages?.length || 1) - 1)));

	$: navAmount =
		volumeSettings.singlePageView ||
		(volumeSettings.hasCover && !volumeSettings.singlePageView && index === 0)
			? 1
			: 2;

	const PAGE_BUFFER = 1;

	// ----------------- Lifecycle -----------------
	onMount(() => {
		if ($settings.defaultFullscreen) {
			document.documentElement.requestFullscreen().catch(() => {});
		}
		pageVisibility = Array(pages.length).fill(false);
		resetControlsTimeout();
	});

	afterUpdate(() => {
		if ($settings.verticalScrolling && pages.length > 0 && !verticalScrollingInitialized) {
			initializeVerticalScrolling();
		} else if (!$settings.verticalScrolling && verticalScrollingInitialized) {
			cleanupVerticalScrolling();
		}
	});

	onDestroy(() => {
		cleanupVerticalScrolling();
		if (controlsTimeout) clearTimeout(controlsTimeout);
		if (loadedVolume?.mokuroData) fireReaderClosedEvent();
	});

	beforeNavigate(() => {
		if (document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
		}
	});

	// ----------------- Reactive visibility window -----------------
	$: {
		const newVisibility = Array(pages.length).fill(false);
		if ($settings.verticalScrolling) {
			const startIndex = Math.max(0, index - PAGE_BUFFER);
			const endIndex = Math.min(pages.length - 1, index + PAGE_BUFFER);
			for (let i = startIndex; i <= endIndex; i++) {
				newVisibility[i] = true;
			}
			newVisibility[index] = true;
		} else {
			newVisibility[index] = true;
			if (showSecondPage()) {
				newVisibility[index + 1] = true;
			}
		}
		pageVisibility = newVisibility;
	}

	$: if (uniqueVolumeId) {
		initialScrollDone = false;
		verticalScrollingInitialized = false;
	}

	$: {
		pagesToLoad = showSecondPage() ? 2 : 1;
	}

	// ----------------- Functions -----------------
	async function onPageLoad() {
		if ($settings.verticalScrolling) return;
		pagesToLoad--;
		if (pagesToLoad <= 0) {
			await tick();
			zoomDefault();
		}
	}

	function resetControlsTimeout() {
		if (controlsTimeout) clearTimeout(controlsTimeout);
		controlsTimeout = setTimeout(() => {
			controlsVisible = false;
		}, 3000);
	}

	function handleCentralClick(event: MouseEvent) {
		const clickY = event.clientY;
		const screenHeight = window.innerHeight;
		if (clickY >= screenHeight * 0.75) {
			controlsVisible = !controlsVisible;
			if (controlsVisible) {
				resetControlsTimeout();
			}
		} else if (controlsVisible) {
			controlsVisible = false;
		}
	}

	async function initializeVerticalScrolling() {
		await tick();
		const pageElements = document.querySelectorAll('.page-container');
		if (pageElements.length === 0) return;
		const options = { root: null as Element | null, rootMargin: '0px', threshold: 0.5 };
		observer = new IntersectionObserver(handleIntersect, options);
		pageElements.forEach((target) => observer.observe(target));
		verticalScrollingInitialized = true;

		// FIX: Correctly resume scroll position.
		if (!initialScrollDone) {
			const currentPageElement = document.querySelector<HTMLElement>(`[data-page-index="${index}"]`);
			if (currentPageElement) {
				currentPageElement.scrollIntoView({ block: 'start', behavior: 'auto' });
				pageVisibility[index] = true;
				await tick();
				initialScrollDone = true;
			}
		}
	}

	function cleanupVerticalScrolling() {
		if (observer) observer.disconnect();
		verticalScrollingInitialized = false;
		initialScrollDone = false;
	}

	function handleIntersect(entries: IntersectionObserverEntry[]) {
		const intersectingEntries = entries.filter((e) => e.isIntersecting);
		if (intersectingEntries.length === 0) return;
		const mostVisibleEntry = intersectingEntries.reduce((prev, current) =>
			prev.intersectionRatio > current.intersectionRatio ? prev : current
		);

		if (mostVisibleEntry) {
			const mostVisibleIndex = parseInt(
				mostVisibleEntry.target.getAttribute('data-page-index') || '0',
				10
			);
			const newPage = mostVisibleIndex + 1;

			if (page !== newPage) {
				updateProgress(
					uniqueVolumeId,
					newPage,
					hasMokuro ? getCharCount(pages, newPage).charCount : 0,
					newPage >= pages.length - 1
				);
			}
		}
	}

	const showSecondPage = () => {
		if (!pages) return false;
		if (volumeSettings.singlePageView || index + 1 >= pages.length) return false;
		if (index === 0 && volumeSettings.hasCover) return false;
		return true;
	};

	function mouseDown() {
		start = new Date();
	}

	function left(_e: any, ignoreTimeout?: boolean) {
		const newPage = volumeSettings.rightToLeft ? page + navAmount : page - navAmount;
		changePage(newPage, ignoreTimeout);
	}

	function right(_e: any, ignoreTimeout?: boolean) {
		const newPage = volumeSettings.rightToLeft ? page - navAmount : page + navAmount;
		changePage(newPage, ignoreTimeout);
	}

	function changePage(newPage: number, ignoreTimeout = false) {
		const end = new Date();
		const clickDuration = ignoreTimeout ? 0 : end.getTime() - (start?.getTime() || 0);

		if (pages && loadedVolume && clickDuration < 200) {
			if (showSecondPage() && page + 1 === pages.length && newPage > page) {
				return;
			}
			const pageClamped = clamp(newPage, 1, pages.length);

			updateProgress(
				uniqueVolumeId,
				pageClamped,
				hasMokuro ? getCharCount(pages, pageClamped).charCount : 0,
				pageClamped >= pages.length - 1
			);

			if ($settings.verticalScrolling) {
				const element = document.querySelector<HTMLElement>(`[data-page-index="${pageClamped - 1}"]`);
				if (element) element.scrollIntoView({ block: 'start', behavior: 'smooth' });
			}
		}
	}

	function handleShortcuts(event: KeyboardEvent & { currentTarget: EventTarget & Window }) {
		if ($settings.verticalScrolling) return;
		const action = event.code || event.key;
		switch (action) {
			case 'ArrowLeft':
				left(event, true);
				break;
			case 'ArrowUp':
			case 'PageUp':
				changePage(page - navAmount, true);
				break;
			case 'ArrowRight':
				right(event, true);
				break;
			case 'ArrowDown':
			case 'PageDown':
			case 'Space':
				changePage(page + navAmount, true);
				break;
			case 'Home':
				changePage(1, true);
				break;
			case 'End':
				if (pages) changePage(pages.length, true);
				break;
			case 'KeyF':
				toggleFullScreen();
				break;
		}
	}

	function handleTouchStart(event: TouchEvent) {
		if ($settings.mobile) {
			const { clientX, clientY } = event.touches[0];
			touchStart = new Date();
			startX = clientX;
			startY = clientY;
		}
	}

	function handlePointerUp(event: TouchEvent) {
		if ($settings.mobile) {
			debounce(() => {
				if (event.touches.length === 0) {
					const { clientX, clientY } = event.changedTouches[0];
					const distanceX = clientX - startX;
					const distanceY = clientY - startY;
					const isSwipe = Math.abs(distanceY) < 200;
					const end = new Date();
					const touchDuration = end.getTime() - (touchStart?.getTime() || 0);

					if (isSwipe && touchDuration < 500) {
						const swipeThreshold = Math.abs(($settings.swipeThreshold / 100) * window.innerWidth);
						if (distanceX > swipeThreshold) {
							left(event, true);
						} else if (distanceX < -swipeThreshold) {
							right(event, true);
						}
					}
				}
			})();
		}
	}

	function onDoubleTap(event: MouseEvent) {
		if (!$settings.mobile || !panzoomStore) return;
		const { clientX, clientY } = event;
		const { scale } = $panzoomStore.getTransform();
		if (scale < 1) $panzoomStore.zoomTo(clientX, clientY, 1.5);
		else zoomFitToScreen();
	}

	function fireReaderClosedEvent() {
		if (loadedVolume?.mokuroData) {
			const { charCount, lineCount } = getCharCount(pages, page);
			fireExstaticEvent('mokuro-reader:reader.closed', {
				title: loadedVolume.mokuroData.title,
				volumeName: loadedVolume.mokuroData.volume,
				currentCharCount: charCount,
				currentPage: page,
				totalPages: pages.length,
				totalCharCount: getCharCount(pages).charCount || 0,
				currentLineCount: lineCount,
				totalLineCount: getCharCount(pages).lineCount
			});
		}
	}
</script>

<svelte:window
	on:resize={$settings.verticalScrolling ? null : zoomDefault}
	on:keyup={handleShortcuts}
	on:touchstart={$settings.verticalScrolling ? null : handleTouchStart}
	on:touchend={$settings.verticalScrolling ? null : handlePointerUp}
/>

<svelte:head>
	<title>{loadedVolume?.volumeName || 'Volume'}</title>
</svelte:head>

{#if loadedVolume && pages && pages.length > 0}
	{#if hasMokuro}
		<Cropper />
	{/if}

	<ReaderControls
		bind:visible={controlsVisible}
		on:pageChange={(e) => changePage(e.detail, true)}
		{pages}
		currentPage={page}
		isRtl={volumeSettings.rightToLeft}
		hasMokuro={!!hasMokuro}
		src1={loadedVolume.files[pages[index]?.img_path]}
		src2={showSecondPage() ? loadedVolume.files[pages[index + 1]?.img_path] : undefined}
	/>

	{#if $settings.verticalScrolling}
		<div
			class="vertical-scrolling-container"
			on:click={handleCentralClick}
			on:keydown={(e) => e.key === 'Enter' && handleCentralClick(e)}
			role="button"
			tabindex="0"
		>
			{#each pages as p, i (p.img_path + i)}
				<div class="page-container" data-page-index={i}>
					{#if pageVisibility[i]}
						<MangaPage
							page={p}
							src={loadedVolume.files[p.img_path]}
							isVertical={true}
							pageHalf={p.split}
						/>
					{:else}
						<div
							style:height={`calc(100vw / ${p.img_width / p.img_height})`}
							style:width={'100vw'}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="relative w-full h-full" on:click={handleCentralClick}>
			<div class="flex" style:background-color={$settings.backgroundColor}>
				<Panzoom>
					<div
						class="flex flex-row"
						class:flex-row-reverse={!volumeSettings.rightToLeft}
						style:filter={`invert(${$settings.invertColors ? 1 : 0})`}
						on:dblclick={onDoubleTap}
						role="none"
						id="manga-panel"
					>
						<div
							class="color-temp-overlay"
							style:background-color={$settings.colorTemperature > 100
								? 'rgba(255, 165, 0, 0.3)'
								: 'rgba(0, 191, 255, 0.3)'}
							style:opacity={Math.abs($settings.colorTemperature - 100) / 100}
						/>
						{#key page}
							{#if pageVisibility[index]}
								<MangaPage
									on:loadcomplete={onPageLoad}
									page={pages[index]}
									src={loadedVolume.files[pages[index].img_path]}
									pageHalf={pages[index].split}
								/>
							{/if}
							{#if showSecondPage() && pageVisibility[index + 1]}
								<MangaPage
									on:loadcomplete={onPageLoad}
									page={pages[index + 1]}
									src={loadedVolume.files[pages[index + 1].img_path]}
									pageHalf={pages[index + 1].split}
								/>
							{/if}
						{/key}
					</div>
				</Panzoom>
			</div>

			<button
				class="left-0 top-0 absolute h-full opacity-0 cursor-pointer"
				style:width={`${$settings.edgeButtonWidth}%`}
				style="z-index: 10;"
				on:mousedown={mouseDown}
				on:mouseup={(e) => {
					e.stopPropagation();
					left(e);
				}}
				aria-label="Previous Page"
			/>
			<button
				class="right-0 top-0 absolute h-full opacity-0 cursor-pointer"
				style:width={`${$settings.edgeButtonWidth}%`}
				style="z-index: 10;"
				on:mousedown={mouseDown}
				on:mouseup={(e) => {
					e.stopPropagation();
					right(e);
				}}
				aria-label="Next Page"
			/>
		</div>
	{/if}
{:else}
	<div class="fixed z-50 left-1/2 top-1/2">
		<Spinner />
	</div>
{/if}

<style>
	.vertical-scrolling-container {
		overflow-y: auto;
		height: 100vh;
	}
	.page-container {
		display: flex;
		justify-content: center;
		padding-bottom: 0px;
		min-height: 500px;
	}
	.color-temp-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		mix-blend-mode: multiply;
		pointer-events: none;
		z-index: 1;
	}
</style>
