<script lang="ts">
  import {
    ClockOutline,
    FolderOutline,
    CogOutline
  } from 'flowbite-svelte-icons';
  import Settings from './Settings/Settings.svelte';
  import RemoteIcon from './RemoteIcon.svelte';
  import Icon from '$lib/assets/icon.webp';

  let settingsHidden = true;
  function openSettings() {
    settingsHidden = false;
  }
</script>

<Settings bind:hidden={settingsHidden} />

<div class="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-gray-200 dark:bg-gray-700 dark:border-gray-600">
  <div class="grid h-full max-w-lg grid-cols-5 mx-auto font-medium">
    <a href="/stats" aria-label="Stats" class="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group">
      <img src={Icon} alt="Mokuro Logo" class="w-8 h-8" />
       <span class="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">Stats</span>
    </a>
    <a href="/" class="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group">
      <ClockOutline class="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
      <span class="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">History</span>
    </a>
    <a href="/local" class="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group">
      <FolderOutline class="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
      <span class="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">Local</span>
    </a>
    <a href="/remote" class="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group">
      <RemoteIcon />
      <span class="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">Remote</span>
    </a>
    <button on:click={openSettings} type="button" class="inline-flex flex-col items-center justify-center px-5 hover:bg-gray-50 dark:hover:bg-gray-800 group">
      <CogOutline
        class="w-6 h-6 mb-1 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500" />
      <span class="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-500">Settings</span>
    </button>
  </div>
</div>