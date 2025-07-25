<script lang="ts">
	import { catalog } from '$lib/catalog';
	import {
		Panzoom,
		panzoomStore,
		toggleFullScreen,
		zoomDefault,
		zoomFitToScreen
	} from '$lib/panzoom';
	import { progress, settings, updateProgress, type VolumeSettings } from '$lib/settings';
	import { clamp, debounce, fireExstaticEvent } from '$lib/util';
	import { Input, Popover, Range, Spinner } from 'flowbite-svelte';
	import MangaPage from './MangaPage.svelte';
	import {
		ChervonDoubleLeftSolid,
		ChervonDoubleRightSolid,
		ChevronLeftSolid,
		ChevronRightSolid
	} from 'flowbite-svelte-icons';
	import Cropper from './Cropper.svelte';
	import { page as pageStore } from '$app/stores';
	import SettingsButton from './SettingsButton.svelte';
	import { getCharCount } from '$lib/util/count-chars';
	import QuickActions from './QuickActions.svelte';
	import { beforeNavigate } from '$app/navigation';
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import type { Page } from '$lib/types';

	export let volumeSettings: VolumeSettings;

	// Component State
	let start: Date;
	let startX = 0;
	let startY = 0;
	let touchStart: Date;
	let manualPage = 1;
	let observer: IntersectionObserver;
	let verticalScrollingInitialized = false;
	let pageVisibility: boolean[] = [];

	// Derived State
	$: volume = $catalog
		?.find((item) => item.id === $pageStore.params.manga)
		?.manga.find((item) => item.mokuroData.volume_uuid === $pageStore.params.volume);
	$: pages = volume?.mokuroData.pages || [];
	$: page = $progress?.[volume?.mokuroData.volume_uuid || ''] || 1;
	$: index = page - 1;
	$: navAmount =
		volumeSettings.singlePageView ||
		(volumeSettings.hasCover && !volumeSettings.singlePageView && index === 0)
			? 1
			: 2;
	$: charCount = $settings.charCount ? getCharCount(pages, page).charCount : 0;
	$: maxCharCount = getCharCount(pages).charCount;
	$: totalLineCount = getCharCount(pages).lineCount;
	$: pageDisplay = showSecondPage()
		? `${page},${page + 1} / ${pages?.length}`
		: `${page} / ${pages?.length}`;
	$: charDisplay = `${charCount} / ${maxCharCount}`;

	const PAGE_BUFFER = 1; // Number of pages to load before and after the current one

	// --- Lifecycle Hooks ---
	onMount(() => {
		if ($settings.defaultFullscreen) {
			document.documentElement.requestFullscreen();
		}
		pageVisibility = Array(pages.length).fill(false);
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
	});

	beforeNavigate(() => {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		}
		fireReaderClosedEvent();
	});

	// --- Reactive Visibility Window ---
	$: {
		const newVisibility = Array(pages.length).fill(false);
		if ($settings.verticalScrolling) {
			const startIndex = Math.max(0, index - PAGE_BUFFER);
			const endIndex = Math.min(pages.length - 1, index + PAGE_BUFFER);
			for (let i = startIndex; i <= endIndex; i++) {
				newVisibility[i] = true;
			}
		} else {
			// Horizontal mode only needs current and possibly next page
			newVisibility[index] = true;
			if (showSecondPage()) {
				newVisibility[index + 1] = true;
			}
		}
		pageVisibility = newVisibility;
	}

	// --- Functions ---
	function initializeVerticalScrolling() {
		const pageElements = document.querySelectorAll('.page-container');
		if (pageElements.length === 0) return;

		const currentPageElement = document.querySelector(`[data-page-index="${index}"]`);
		if (currentPageElement) {
			currentPageElement.scrollIntoView({ block: 'start', behavior: 'instant' });
		}

		const options = { root: null, rootMargin: '0px', threshold: 0.5 };
		observer = new IntersectionObserver(handleIntersect, options);
		pageElements.forEach((target) => observer.observe(target));
		verticalScrollingInitialized = true;
	}

	function cleanupVerticalScrolling() {
		if (observer) observer.disconnect();
		verticalScrollingInitialized = false;
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
					volume!.mokuroData.volume_uuid,
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
		const clickDuration = ignoreTimeout ? 0 : end.getTime() - start?.getTime();

		if (pages && volume && clickDuration < 200) {
			if (showSecondPage() && page + 1 === pages.length && newPage > page) {
				return;
			}
			const pageClamped = clamp(newPage, 1, pages.length);
			updateProgress(
				volume.mokuroData.volume_uuid,
				pageClamped,
				getCharCount(pages, pageClamped).charCount,
				pageClamped >= pages.length - 1
			);
			if (!$settings.verticalScrolling) {
				zoomDefault();
			}
		}
	}

	function onInputClick(this: any) {
		this.select();
	}

	function onManualPageChange() {
		changePage(manualPage, true);
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
		if (volume) {
			const { charCount, lineCount } = getCharCount(pages, page);
			fireExstaticEvent('mokuro-reader:reader.closed', {
				title: volume.mokuroData.title,
				volumeName: volume.mokuroData.volume,
				currentCharCount: charCount,
				currentPage: page,
				totalPages: pages.length,
				totalCharCount: maxCharCount || 0,
				currentLineCount: lineCount,
				totalLineCount
			});
		}
	}

	$: {
		if (volume) {
			const { charCount, lineCount } = getCharCount(pages, page);
			fireExstaticEvent('mokuro-reader:page.change', {
				title: volume.mokuroData.title,
				volumeName: volume.mokuroData.volume,
				currentCharCount: charCount,
				currentPage: page,
				totalPages: pages.length,
				totalCharCount: maxCharCount || 0,
				currentLineCount: lineCount,
				totalLineCount
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
	<title>{volume?.mokuroData.volume || 'Volume'}</title>
</svelte:head>

{#if volume && pages}
	<SettingsButton />
	<Cropper />
	<QuickActions
		{left}
		{right}
		src1={Object.values(volume?.files)[index]}
		src2={!volumeSettings.singlePageView ? Object.values(volume?.files)[index + 1] : undefined}
		isVertical={$settings.verticalScrolling}
	/>
	<Popover placement="bottom" trigger="click" triggeredBy="#page-num" class="z-20 w-full max-w-xs">
		<div class="flex flex-col gap-3">
			<div class="flex flex-row items-center gap-5 z-10">
				<ChervonDoubleLeftSolid
					on:click={() => changePage(volumeSettings.rightToLeft ? pages.length : 1, true)}
					class="hover:text-primary-600"
					size="sm"
				/>
				<ChevronLeftSolid on:click={(e) => left(e, true)} class="hover:text-primary-600" size="sm" />
				<Input
					type="number"
					size="sm"
					bind:value={manualPage}
					on:click={onInputClick}
					on:change={onManualPageChange}
				/>
				<ChevronRightSolid on:click={(e) => right(e, true)} class="hover:text-primary-600" size="sm" />
				<ChervonDoubleRightSolid
					on:click={() => changePage(volumeSettings.rightToLeft ? 1 : pages.length, true)}
					class="hover:text-primary-600"
					size="sm"
				/>
			</div>
			<div style:direction={volumeSettings.rightToLeft ? 'rtl' : 'ltr'}>
				<Range
					min={1}
					max={pages.length}
					bind:value={manualPage}
					on:change={onManualPageChange}
					defaultClass=""
				/>
			</div>
		</div>
	</Popover>
	<button class="absolute opacity-50 left-5 top-5 z-10 mix-blend-difference" id="page-num">
		<p class="text-left" class:hidden={!$settings.charCount}>{charDisplay}</p>
		<p class="text-left" class:hidden={!$settings.pageNum}>{pageDisplay}</p>
	</button>

	{#if $settings.verticalScrolling}
		<div class="vertical-scrolling-container">
			{#each pages as p, i (p.img_path)}
				<div class="page-container" data-page-index={i}>
					{#if pageVisibility[i]}
						<MangaPage page={p} src={Object.values(volume?.files)[i]} isVertical={true} />
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
				<button
					class="h-full fixed -left-full z-10 w-full hover:bg-slate-400 opacity-[0.01]"
					style:margin-left={`${$settings.edgeButtonWidth}px`}
					on:mousedown={mouseDown}
					on:mouseup={left}
				/>
				<button
					class="h-full fixed -right-full z-10 w-full hover:bg-slate-400 opacity-[0.01]"
					style:margin-right={`${$settings.edgeButtonWidth}px`}
					on:mousedown={mouseDown}
					on:mouseup={right}
				/>
				<button
					class="h-screen fixed top-full -left-full z-10 w-[150%] hover:bg-slate-400 opacity-[0.01]"
					on:mousedown={mouseDown}
					on:mouseup={left}
				/>
				<button
					class="h-screen fixed top-full -right-full z-10 w-[150%] hover:bg-slate-400 opacity-[0.01]"
					on:mousedown={mouseDown}
					on:mouseup={right}
				/>
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
							<MangaPage page={pages[index + 1]} src={Object.values(volume?.files)[index + 1]} />
						{/if}
						<MangaPage page={pages[index]} src={Object.values(volume?.files)[index]} />
					{/key}
				</div>
			</Panzoom>
		</div>
		{#if !$settings.mobile}
			<button
				on:mousedown={mouseDown}
				on:mouseup={left}
				class="left-0 top-0 absolute h-full w-16 hover:bg-slate-400 opacity-[0.01]"
				style:width={`${$settings.edgeButtonWidth}px`}
			/>
			<button
				on:mousedown={mouseDown}
				on:mouseup={right}
				class="right-0 top-0 absolute h-full w-16 hover:bg-slate-400 opacity-[0.01]"
				style:width={`${$settings.edgeButtonWidth}px`}
			/>
		{/if}
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
		/* Each page container needs a minimum height to be observable before the image loads */
		min-height: 500px;
	}
</style>