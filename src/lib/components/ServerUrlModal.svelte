<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
    import { createEventDispatcher } from 'svelte';

	export let open = false;
    const dispatch = createEventDispatcher();

	let serverUrl = '';
	let serverUsername = '';
	let serverPassword = '';

	function onSave() {
		dispatch('save', {
            url: serverUrl,
            username: serverUsername,
            password: serverPassword
        });
		open = false;
        // Reset fields after saving
        serverUrl = '';
        serverUsername = '';
        serverPassword = '';
	}
</script>

<Modal title="Add Remote Source" bind:open on:close>
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

		<Button on:click={onSave} disabled={!serverUrl}>Save</Button>
	</div>
</Modal>