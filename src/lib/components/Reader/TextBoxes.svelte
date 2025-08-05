<script lang="ts">
	import { clamp } from '$lib/util';
	import type { Page } from '$lib/types';
	import { settings } from '$lib/settings';
	import { imageToWebp, showCropper, updateLastCard } from '$lib/anki-connect';
	import { promptConfirmation } from '$lib/util';

	export let page: Page;
	export let src: File | Blob;
	export let scaleFactor = 1;
	export let cropOffsetX = 0;
	export let cropOffsetY = 0;
	export let containerImageOffsetX = 0;
	export let containerImageOffsetY = 0;
	export let pageHalf: 'left' | 'right' | undefined = undefined;

	$: textBoxes = page.blocks
		.map((block) => {
			if (!block.box) {
				return null;
			}
			const { img_height, img_width } = page;
			const { box, font_size, lines, vertical } = block;

			let [_xmin, _ymin, _xmax, _ymax] = box;

			const halfWidth = img_width / 2;
			if (pageHalf === 'left') {
				if (_xmin >= halfWidth) return null; // Filter out boxes on the other half
				_xmax = Math.min(_xmax, halfWidth);
			} else if (pageHalf === 'right') {
				if (_xmax <= halfWidth) return null; // Filter out boxes on the other half
				_xmin = Math.max(0, _xmin - halfWidth);
				_xmax -= halfWidth;
			}

			const xmin = clamp(_xmin, 0, pageHalf ? halfWidth : img_width);
			const ymin = clamp(_ymin, 0, img_height);
			const xmax = clamp(_xmax, 0, pageHalf ? halfWidth : img_width);
			const ymax = clamp(_ymax, 0, img_height);

			const finalXMin = xmin - cropOffsetX;
			const finalYMin = ymin - cropOffsetY;

			const width = xmax - xmin;
			const height = ymax - ymin;
			const area = width * height;
			if (width <= 0 || height <= 0) return null;

			const scaledFontSize =
				$settings.fontSize === 'auto' ? font_size * scaleFactor : parseFloat($settings.fontSize);
			const finalFontSizeUnit = $settings.fontSize === 'auto' ? 'px' : 'pt';

			const textBox = {
				left: `${containerImageOffsetX + finalXMin * scaleFactor}px`,
				top: `${containerImageOffsetY + finalYMin * scaleFactor}px`,
				width: `${width * scaleFactor}px`,
				height: `${height * scaleFactor}px`,
				fontSize: `${scaledFontSize}${finalFontSizeUnit}`,
				writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
				lines,
				area
			};

			return textBox;
		})
		.filter(Boolean)
		.sort(({ area: a }, { area: b }) => {
			return b - a;
		});

	$: fontWeight = $settings.boldFont ? 'bold' : '400';
	$: display = $settings.displayOCR ? 'block' : 'none';
	$: border = $settings.textBoxBorders ? '1px solid red' : 'none';
	$: contenteditable = $settings.textEditable;
	$: triggerMethod = $settings.ankiConnectSettings.triggerMethod || 'both';

	async function onUpdateCard(lines: string[]) {
		if ($settings.ankiConnectSettings.enabled) {
			const sentence = lines.join(' ');
			if ($settings.ankiConnectSettings.cropImage) {
				showCropper(URL.createObjectURL(src), sentence);
			} else {
				promptConfirmation('Add image to last created anki card?', async () => {
					const imageData = await imageToWebp(src as File, $settings);
					updateLastCard(imageData, sentence);
				});
			}
		}
	}

	function onContextMenu(event: Event, lines: string[]) {
		if (triggerMethod === 'both' || triggerMethod === 'rightClick') {
			event.preventDefault();
			onUpdateCard(lines);
		}
	}

	function onDoubleTap(event: Event, lines: string[]) {
		if (triggerMethod === 'both' || triggerMethod === 'doubleTap') {
			event.preventDefault();
			onUpdateCard(lines);
		}
	}
</script>

{#each textBoxes as { fontSize, height, left, lines, top, width, writingMode }, index (`textBox-${index}`)}
	<div
		class="textBox"
		style:width
		style:height
		style:left
		style:top
		style:font-size={fontSize}
		style:font-weight={fontWeight}
		style:display
		style:border
		style:writing-mode={writingMode}
		role="button"
		tabindex="0"
		on:contextmenu={(e) => onContextMenu(e, lines)}
		on:dblclick={(e) => onDoubleTap(e, lines)}
		{contenteditable}
	>
		{#each lines as line}
			<p>{line}</p>
		{/each}
	</div>
{/each}

<style>
	.textBox {
		color: black;
		padding: 0;
		position: absolute;
		line-height: 1.1em;
		font-size: 16pt;
		white-space: nowrap;
		border: 1px solid rgba(0, 0, 0, 0);
		z-index: 11;
		pointer-events: all;
	}

	.textBox:focus,
	.textBox:hover {
		background: rgba(255, 255, 255, 0.8);
		border: 1px solid rgba(0, 0, 0, 0);
	}

	.textBox p {
		display: none;
		white-space: nowrap;
		letter-spacing: 0.1em;
		line-height: 1.1em;
		margin: 0;
		background-color: rgba(255, 255, 255, 0.8);
		z-index: 11;
	}

	.textBox:focus p,
	.textBox:hover p {
		display: table;
	}
</style>