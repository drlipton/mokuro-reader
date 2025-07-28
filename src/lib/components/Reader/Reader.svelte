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
	import { beforeNavigate, goto } from '$app/navigation';
	import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
	import type { Page, Volume } from '$lib/types';
    import ReaderControls from './ReaderControls.svelte';
	import { getCharCount } from '$lib/util/count-chars';
    import { Spinner } from 'flowbite-svelte';

	export let loadedVolume: Volume;
	export let volumeSettings: VolumeSettings;

	// Component State
	let start: Date;
	let startX = 0;
	let startY = 0;
	let touchStart: Date;
	let observer: IntersectionObserver;
	let verticalScrollingInitialized = false;
	let initialScrollDone = false;
	let pageVisibility: boolean[] = [];
    let controlsVisible = true;
    let controlsTimeout: NodeJS.Timeout;

	// Derived State
	$: pages = loadedVolume?.mokuroData.pages || [];
	$: page = $progress?.[loadedVolume?.mokuroData.volume_uuid || ''] || 1;
	$: index = page - 1;
	$: navAmount =
		volumeSettings.singlePageView ||
		(volumeSettings.hasCover && !volumeSettings.singlePageView && index === 0)
			? 1
			: 2;

	const PAGE_BUFFER = 1;
	// --- Lifecycle Hooks ---
	onMount(() => {
		if ($settings.defaultFullscreen) {
			document.documentElement.requestFullscreen();
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
		fireReaderClosedEvent();
	});
	beforeNavigate(() => {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		}
	});

	// --- Reactive Logic ---
	$: {
		const newVisibility = Array(pages.length).fill(false);
		if ($settings.verticalScrolling) {
			const startIndex = Math.max(0, index - PAGE_BUFFER);
			const endIndex = Math.min(pages.length - 1, index + PAGE_BUFFER);
			for (let i = startIndex; i <= endIndex; i++) {
				newVisibility[i] = true;
			}
            // Fallback to ensure current page is always visible
            newVisibility[index] = true;
		} else {
			newVisibility[index] = true;
			if (showSecondPage()) {
				newVisibility[index + 1] = true;
			}
		}
		pageVisibility = newVisibility;
	}

	$: if (loadedVolume) {
		initialScrollDone = false;
		verticalScrollingInitialized = false;
	}

	// --- Functions ---
    function resetControlsTimeout() {
        if (controlsTimeout) clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            controlsVisible = false;
        }, 3000);
    }

    function toggleControls() {
        controlsVisible = !controlsVisible;
        if (controlsVisible) {
            resetControlsTimeout();
        }
    }

	async function initializeVerticalScrolling() {
		await tick(); 

		const pageElements = document.querySelectorAll('.page-container');
		if (pageElements.length === 0) return;

		const options = { root: null, rootMargin: '0px', threshold: 0.5 };
		observer = new IntersectionObserver(handleIntersect, options);
		pageElements.forEach((target) => observer.observe(target));
		verticalScrollingInitialized = true;

		if (!initialScrollDone) {
			const currentPageElement = document.querySelector(`[data-page-index="${index}"]`);
			if (currentPageElement) {
				currentPageElement.scrollIntoView({ block: 'start', behavior: 'instant' });
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
				mostVisibleEntry.target.getAttribute('data-page-index') || '0'
			);
			const newPage = mostVisibleIndex + 1;
			if (page !== newPage) {
				updateProgress(
					loadedVolume!.mokuroData.volume_uuid,
					newPage,
					getCharCount(pages, newPage).charCount,
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
		const clickDuration = ignoreTimeout ?
			0 : end.getTime() - start?.getTime();

		if (pages && loadedVolume && clickDuration < 200) {
			if (showSecondPage() && page + 1 === pages.length && newPage > page) {
				return;
			}
			const pageClamped = clamp(newPage, 1, pages.length);
			updateProgress(
				loadedVolume.mokuroData.volume_uuid,
				pageClamped,
				getCharCount(pages, pageClamped).charCount,
				pageClamped >= pages.length - 1
			);
			if (!$settings.verticalScrolling) {
				zoomDefault();
			} else {
                const element = document.querySelector(`[data-page-index="${pageClamped - 1}"]`);
                if (element) {
                    element.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }
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
					const touchDuration = end.getTime() - touchStart?.getTime();

					if (isSwipe && touchDuration < 500) {
						const swipeThreshold = Math.abs(($settings.swipeThreshold / 100) * window.innerWidth);
						if (distanceX > swipeThreshold) {
							left(event, true);
						} else if (distanceX < -swipeThreshold) {
							right(event, true);
						}
					}
				}
			});
		}
	}

	function onDoubleTap(event: MouseEvent) {
		if ($panzoomStore && $settings.mobile) {
			const { clientX, clientY } = event;
			const { scale } = $panzoomStore.getTransform();
			if (scale < 1) {
				$panzoomStore.zoomTo(clientX, clientY, 1.5);
			} else {
				zoomFitToScreen();
			}
		}
	}

	function fireReaderClosedEvent() {
		if (loadedVolume) {
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
	on:touchstart={$settings.verticalScrolling ?
		null : handleTouchStart}
	on:touchend={$settings.verticalScrolling ? null : handlePointerUp}
/>
<svelte:head>
	<title>{loadedVolume?.mokuroData.volume || 'Volume'}</title>
</svelte:head>

{#if loadedVolume && pages}
	<Cropper />

	<ReaderControls
		bind:visible={controlsVisible}
		on:pageChange={(e) => changePage(e.detail, true)}
		{pages}
		currentPage={page}
		isRtl={volumeSettings.rightToLeft}
		src1={Object.values(loadedVolume?.files)[index]}
		src2={!volumeSettings.singlePageView ? Object.values(loadedVolume?.files)[index + 1] : undefined}
	/>

	<div
		role="button"
		tabindex="0"
		on:click={toggleControls}
		on:keypress={toggleControls}
		class="w-full h-full"
	>
		{#if $settings.verticalScrolling}
			<div class="vertical-scrolling-container">
				{#each pages as p, i (p.img_path)}
					<div class="page-container" data-page-index={i}>
						{#if pageVisibility[i]}
							<MangaPage page={p} src={Object.values(loadedVolume?.files)[i]} isVertical={true} />
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
						{#key page}
							{#if showSecondPage()}
								<MangaPage
									page={pages[index + 1]}
									src={Object.values(loadedVolume?.files)[index + 1]}
								/>
							{/if}
							<MangaPage page={pages[index]} src={Object.values(loadedVolume?.files)[index]} />
						{/key}
					</div>
				</Panzoom>
			</div>
		{/if}
	</div>
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
</style>