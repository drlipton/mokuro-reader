<script lang="ts">
  import Catalog from '$lib/components/Catalog.svelte';
  import HistoryList from '$lib/components/HistoryList.svelte';
</script>

<svelte:head>
  <title>Mokuro</title>
</svelte:head>

<div class="p-2">
  <HistoryList />
  <Catalog />
</div>