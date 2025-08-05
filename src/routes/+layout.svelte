<script lang="ts">
  import '../app.postcss';
  import { dev } from '$app/environment';
  import { inject } from '@vercel/analytics';
  import Snackbar from '$lib/components/Snackbar.svelte';
  import ConfirmationPopup from '$lib/components/ConfirmationPopup.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { page } from '$app/stores';
  import { beforeNavigate, afterNavigate } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  inject({ mode: dev ? 'development' : 'production' });

  let isReader = false;

  // --- TRANSITION LOGIC ---
  const routeOrder: Record<string, number> = {
      '/': 0,
      '/local': 1,
      '/remote': 2,
  };

  let transitionDirection = 1;

  beforeNavigate(({ from, to }) => {
      const fromPath = from?.url.pathname || '/';
      const toPath = to?.url.pathname || '/';

      const fromIndex = routeOrder[fromPath] ?? -1;
      const toIndex = routeOrder[toPath] ?? -1;
      
      // Only apply slide transition between main tabs
      if (fromIndex !== -1 && toIndex !== -1) {
        transitionDirection = toIndex > fromIndex ? 1 : -1;
      } else {
        // Use a default for other navigation (e.g., fade)
        transitionDirection = 0; 
      }
  });
  
  afterNavigate(() => {
    isReader = $page.route.id === '/[manga]/[volume]';
  });

</script>

<div class="pb-16 h-full min-h-[100svh] text-white">
  <div class="relative overflow-x-hidden">
    {#key $page.url.pathname}
      <div 
        in:fly={{ x: transitionDirection === 0 ? 0 : 300 * transitionDirection, duration: 250, easing: quintOut }} 
        out:fly={{ x: transitionDirection === 0 ? 0 : -300 * transitionDirection, duration: 250, easing: quintOut }}
        class="absolute w-full"
      >
        <main class="p-2">
          <slot />
        </main>
      </div>
    {/key}
  </div>

  {#if !isReader}
    <BottomNav />
  {/if}
  <Snackbar />
  <ConfirmationPopup />
</div>

<style>
  /* This ensures the content div doesn't collapse during transitions */
  .relative {
    min-height: calc(100vh - 4rem); /* 100vh minus bottom nav height */
  }
</style>