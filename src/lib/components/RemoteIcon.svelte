<script lang="ts">
  import { onMount } from 'svelte';
  import type { ComponentType } from 'svelte';

  let Icon: ComponentType | null = null;

  onMount(async () => {
    // Dynamically import the icon component only in the browser
    const module = await import('flowbite-svelte-icons');
    Icon = module.CloudArrowUpOutline;
  });
</script>

{#if Icon}
  <svelte:component this={Icon} class="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
{:else}
  <div class="w-6 h-6 mb-1"></div>
{/if}