<script lang="ts">
	import { miscSettings, updateMiscSetting } from '$lib/settings';
	import { Button, Input, Label, Modal } from 'flowbite-svelte';

	export let open = false;

	let serverUrl = $miscSettings.serverUrl;
	let serverUsername = $miscSettings.serverUsername;
	let serverPassword = $miscSettings.serverPassword;

	function onSave() {
		updateMiscSetting('serverUrl', serverUrl);
		updateMiscSetting('serverUsername', serverUsername);
		updateMiscSetting('serverPassword', serverPassword);
		open = false;
	}
</script>

<Modal title="Set Server URL" bind:open on:close>
	<div class="flex flex-col gap-4">
		<div>
			<Label for="server-url" class="mb-2">Manga Server URL</Label>
			<Input id="server-url" type="text" bind:value={serverUrl} placeholder="https://..." />
		</div>
		<div>
			<Label for="server-user" class="mb-2">Username (Optional)</Label>
			<Input id="server-user" type="text" bind:value={serverUsername} />
		</div>
		<div>
			<Label for="server-pass" class="mb-2">Password (Optional)</Label>
			<Input id="server-pass" type="password" bind:value={serverPassword} />
		</div>

		<Button on:click={onSave}>Save</Button>
	</div>
</Modal>