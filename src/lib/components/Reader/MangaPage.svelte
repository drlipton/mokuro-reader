<script lang="ts">
  import type { Page } from '$lib/types';
  import { afterUpdate, onMount, onDestroy } from 'svelte';
  import TextBoxes from './TextBoxes.svelte';
  import { zoomDefault } from '$lib/panzoom';

  export let page: Page;
  export let src: File;
  export let isVertical = false; // Add this new prop

  $: url = src ? `url(${URL.createObjectURL(src)})` : '';

  let legacy: HTMLElement | null;
  let containerWidth: number;

  onMount(() => {
    legacy = document.getElementById('popupAbout');
    if (!isVertical) {
      zoomDefault();
    }

    return () => {
      if (!isVertical) {
        setTimeout(() => {
          zoomDefault();
        }, 10);
      }
    };
  });
  $: {
    if (legacy) {
      legacy.style.backgroundImage = url;
    }
  }

  afterUpdate(() => {
    if (!isVertical) {
      zoomDefault();
    }
  });

  $: aspectRatio = page.img_width / page.img_height;
  $: scaleFactor = containerWidth / page.img_width;
</script>

<div
  bind:clientWidth={containerWidth}
  draggable="false"
  style:width={isVertical ? '100vw' : `${page.img_width}px`}
  style:height={isVertical
    ? `calc(100vw / ${aspectRatio})`
    : `${page.img_height}px`}
  style:background-image={url}
  class="relative bg-contain bg-no-repeat bg-center"
>
  <TextBoxes {page} {src} {scaleFactor} isVertical={isVertical} />
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