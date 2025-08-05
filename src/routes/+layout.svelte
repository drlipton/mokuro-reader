<script lang="ts">
  import '../app.postcss';
  import { dev } from '$app/environment';
  import { inject } from '@vercel/analytics';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';

  inject({ mode: dev ? 'development' : 'production' });

  let isReader = false;

  afterNavigate(() => {
    isReader = $page.route.id === '/[manga]/[volume]';
  });
</script>

<div class="pb-16 h-full min-h-[100svh] text-white">
  <main class="p-2">
    <slot />
  </main>

  {#if !isReader}
    <BottomNav />
  {/if}
  <Snackbar />
  <ConfirmationPopup />
</div>