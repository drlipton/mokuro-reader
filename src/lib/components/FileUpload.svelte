<script lang="ts">
  import { A } from 'flowbite-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let input: HTMLInputElement;

  function handleChange() {
    if (input.files) {
      dispatch('fileSelected', input.files);
    }
  }
</script>

<input
  type="file"
  bind:this={input}
  on:change={handleChange}
  {...$$restProps}
  class="hidden"
/>

<A on:click={() => input.click()}><slot>Upload</slot></A>