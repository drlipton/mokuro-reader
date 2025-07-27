<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { ListgroupItem } from 'flowbite-svelte';

  export let id: string;
  export let isRemote = false;
  export let remoteCoverUrl: string | null = null;
  $: manga = isRemote ? { mokuroData: { title: id }, files: null } : $catalog?.find((item) => item.id === id)?.manga[0];
</script>

{#if manga}
  <div>
    <ListgroupItem>
      <a href={isRemote ? `/${encodeURIComponent(id)}?source=server` : id} class="h-full w-full">
        <div class="flex justify-between items-center">
          <p class="font-semibold text-white">{manga.mokuroData.title}</p>
          {#if isRemote && remoteCoverUrl}
            <img
              src={remoteCoverUrl}
              alt="img"
              class="object-contain w-[50px] h-[70px] bg-black border-gray-900 border"
            />
          {:else if manga.files}
            <img
              src={URL.createObjectURL(Object.values(manga.files)[0])}
              alt="img"
              class="object-contain w-[50px] h-[70px] bg-black border-gray-900 border"
            />
          {/if}
        </div>
      </a>
    </ListgroupItem>
  </div>
{/if}