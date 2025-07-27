<script lang="ts">
  import { catalog } from '$lib/catalog';
  import { volumes, miscSettings } from '$lib/settings';

  export let id: string;
  export let isRemote = false;
  export let remoteCoverUrl: string | null = null;
  export let volumeCount: number | undefined = undefined;

  $: manga = isRemote ? { mokuroData: { title: id }, files: null } : $catalog?.find((item) => item.id === id)?.manga[0];
  $: completedVolumes = isRemote
    ? Object.keys($volumes).filter(key => key.startsWith(`${$miscSettings.serverUrl}/${id}/`) && $volumes[key].completed).length
    : $catalog?.find(item => item.id === id)?.manga.filter(vol => $volumes[vol.mokuroData.volume_uuid]?.completed).length || 0;
</script>

{#if manga}
  <a href={isRemote ? `/${encodeURIComponent(id)}?source=server` : id}>
    <div
      class="flex flex-col gap-[5px] text-center items-center bg-slate-900 pb-1 bg-opacity-50 border border-slate-950"
    >
      {#if isRemote && remoteCoverUrl}
        <img
          src={remoteCoverUrl}
          alt="img"
          class="object-contain sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border"
        />
      {:else if manga.files}
        <img
          src={URL.createObjectURL(Object.values(manga.files)[0])}
          alt="img"
          class="object-contain sm:w-[250px] sm:h-[350px] bg-black border-gray-900 border"
        />
      {/if}
      <p class="font-semibold sm:w-[250px] line-clamp-1">
        {manga.mokuroData.title}
      </p>
      {#if volumeCount !== undefined}
        <p class="text-sm text-gray-400">{completedVolumes} / {volumeCount} volumes</p>
      {/if}
    </div>
  </a>
{/if}