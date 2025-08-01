<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button, Range, Tooltip } from 'flowbite-svelte';
	import {
		HomeSolid,
		ImageOutline,
		CompressOutline,
		ZoomOutOutline,
		UserSettingsSolid,
	} from 'flowbite-svelte-icons';
	import { toggleFullScreen, zoomFitToScreen } from '$lib/panzoom';
	import { settings, updateSetting } from '$lib/settings';
	import { imageToWebp, showCropper, updateLastCard } from '$lib/anki-connect';
	import { promptConfirmation } from '$lib/util';
	import Settings from '$lib/components/Settings/Settings.svelte';

	export let visible = false;
	export let pages: any[];
	export let currentPage: number;
	export let isRtl: boolean;
	export let src1: File | undefined;
	export let src2: File | undefined;

	const dispatch = createEventDispatcher();

	let settingsHidden = true;

	function onManualPageChange() {
		dispatch('pageChange', currentPage);
	}

	async function onUpdateCard(src: File | undefined) {
		if ($settings.ankiConnectSettings.enabled && src) {
			if ($settings.ankiConnectSettings.cropImage) {
				showCropper(URL.createObjectURL(src));
			} else {
				promptConfirmation('Add image to last created anki card?', async () => {
					const imageData = await imageToWebp(src, $settings);
					updateLastCard(imageData);
				});
			}
		}
	}
</script>

<Settings bind:hidden={settingsHidden} />

<div
	class="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300"
	class:translate-y-full={!visible}
	role="toolbar"
>
	<div class="bg-gray-900 bg-opacity-80 backdrop-blur-sm p-2 md:p-4 text-white">
		<div class="flex justify-between items-center max-w-4xl mx-auto">
			<div class="flex-1 flex justify-start">
				<Tooltip>Home</Tooltip>
				<Button on:click={() => goto('/')} color="none" class="text-white hover:bg-gray-700 p-2 rounded-full">
					<HomeSolid />
				</Button>
			</div>

			<div class="w-full max-w-md flex flex-col items-center">
				<span class="text-sm">Page {currentPage} of {pages.length}</span>
				<div class="w-full mt-1" style:direction={isRtl ? 'rtl' : 'ltr'}>
					<Range
						min={1}
						max={pages.length}
						bind:value={currentPage}
						on:change={onManualPageChange}
						class="w-full"
					/>
				</div>
			</div>

			<div class="flex-1 flex justify-end items-center gap-1">
				<Tooltip>Toggle Vertical Scroll</Tooltip>
				<Button
					on:click={() => updateSetting('verticalScrolling', !$settings.verticalScrolling)}
					color="none"
					class="text-white hover:bg-gray-700 p-2 rounded-full {$settings.verticalScrolling ? '!text-primary-500' : ''}"
				>
				</Button>

				{#if $settings.ankiConnectSettings.enabled}
					<Tooltip>Anki Card from Page 1</Tooltip>
					<Button on:click={() => onUpdateCard(src1)} color="none" class="text-white hover:bg-gray-700 p-2 rounded-full">
						<ImageOutline />
					</Button>
					{#if src2}
						<Tooltip>Anki Card from Page 2</Tooltip>
						<Button on:click={() => onUpdateCard(src2)} color="none" class="text-white hover:bg-gray-700 p-2 rounded-full">
							<ImageOutline />
						</Button>
					{/if}
				{/if}
				<Tooltip>Fullscreen</Tooltip>
				<Button on:click={toggleFullScreen} color="none" class="text-white hover:bg-gray-700 p-2 rounded-full">
					<CompressOutline />
				</Button>
				<Tooltip>Fit to Screen</Tooltip>
				<Button on:click={zoomFitToScreen} color="none" class="text-white hover:bg-gray-700 p-2 rounded-full">
					<ZoomOutOutline />
				</Button>
				<Tooltip>Settings</Tooltip>
				<Button on:click={() => (settingsHidden = false)} color="none" class="text-white hover:bg-gray-700 p-2 rounded-full">
					<UserSettingsSolid />
				</Button>
			</div>
		</div>
	</div>
</div>