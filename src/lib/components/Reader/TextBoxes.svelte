<script lang="ts">
	import { clamp } from '$lib/util';
	import type { Page } from '$lib/types';
	import { settings } from '$lib/settings';
	import { imageToWebp, showCropper, updateLastCard } from '$lib/anki-connect';

	export let page: Page;
	export let src: File;
	export let scaleFactor: number = 1;
	export let isVertical: boolean = false;
	// Accept the crop offsets
	export let cropOffsetX = 0;
	export let cropOffsetY = 0;

	// This is the original logic from your file
	$: textBoxes = page.blocks
		.map((block) => {
			// Ensure the block has a 'box' property before processing
			if (!block.box) {
				return null;
			}
			const { img_height, img_width } = page;
			const { box, font_size, lines, vertical } = block;

			let [_xmin, _ymin, _xmax, _ymax] = box;

			const xmin = clamp(_xmin, 0, img_width);
			const ymin = clamp(_ymin, 0, img_height);
			const xmax = clamp(_xmax, 0, img_width);
			const ymax = clamp(_ymax, 0, img_height);

			const width = xmax - xmin;
			const height = ymax - ymin;
			const area = width * height;

			const scaledFontSize =
				$settings.fontSize === 'auto' ? font_size * scaleFactor : parseFloat($settings.fontSize);
			const finalFontSizeUnit = $settings.fontSize === 'auto' ? 'px' : 'pt';

			const textBox = {
				// HERE IS THE FIX: We subtract the offsets before applying the scale factor
				left: `${(xmin - cropOffsetX) * scaleFactor}px`,
				top: `${(ymin - cropOffsetY) * scaleFactor}px`,
				width: `${width * scaleFactor}px`,
				height: `${height * scaleFactor}px`,
				fontSize: `${scaledFontSize}${finalFontSizeUnit}`,
				writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
				lines,
				area
			};

			return textBox;
		})
		// Filter out any null blocks that were skipped
		.filter(Boolean)
		.sort(({ area: a }, { area: b }) => {
			return b - a;
		});

	// All the remaining logic is from your original file
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
				// This import was missing from your original file, so I am commenting it out.
				// If you need it, ensure `promptConfirmation` is exported from `$lib/util`.
				// promptConfirmation('Add image to last created anki card?', async () => {
				//   const imageData = await imageToWebp(src, $settings);
				//   updateLastCard(imageData, sentence);
				// });
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
		role="none"
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
	/* Styles from your original file */
	.textBox {
		color: black;
		padding: 0;
		position: absolute;
		line-height: 1.1em;
		font-size: 16pt;
		white-space: nowrap;
		border: 1px solid rgba(0, 0, 0, 0);
		z-index: 11;
	}

	.textBox:focus,
	.textBox:hover {
		background: rgb(255, 255, 255);
		border: 1px solid rgba(0, 0, 0, 0);
	}

	.textBox p {
		display: none;
		white-space: nowrap;
		letter-spacing: 0.1em;
		line-height: 1.1em;
		margin: 0;
		background-color: rgb(255, 255, 255);
		font-weight: var(--bold);
		z-index: 11;
	}

	.textBox:focus p,
	.textBox:hover p {
		display: table;
	}
</style>