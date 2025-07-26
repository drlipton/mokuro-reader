<script lang="ts">
	import { miscSettings, updateMiscSetting } from '$lib/settings';
	import { Button, Input, Label, Modal } from 'flowbite-svelte';

	export let open = false;

	let serverUrl = $miscSettings.serverUrl;

	function onSave() {
		updateMiscSetting('serverUrl', serverUrl);
		open = false;
	}
</script>

<Modal title="Set Server URL" bind:open on:close>
	<div class="flex flex-col gap-4">
		<Label for="server-url" class="mb-2">Manga Server URL</Label>
		<Input id="server-url" type="text" bind:value={serverUrl} placeholder="https://example.com/manga" />
		<Button on:click={onSave}>Save</Button>
	</div>
</Modal>