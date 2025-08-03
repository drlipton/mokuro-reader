<script lang="ts">
  import { AccordionItem, Button, Label, Range } from 'flowbite-svelte';
  import ReaderSelects from './ReaderSelects.svelte';
  import ReaderToggles from './ReaderToggles.svelte';
  import { settings, updateSetting } from '$lib/settings';

  let swipeThresholdValue = $settings.swipeThreshold;
  let edgeButtonWidthValue = $settings.edgeButtonWidth;
  let colorTemperatureValue = $settings.colorTemperature;
  function onSwipeChange() {
    updateSetting('swipeThreshold', swipeThresholdValue);
  }

  function onWidthChange() {
    updateSetting('edgeButtonWidth', edgeButtonWidthValue);
  }
  function onColorTempChange() {
    updateSetting('colorTemperature', colorTemperatureValue);
  }
</script>

<AccordionItem>
  <span slot="header">Reader</span>
  <div class="flex flex-col gap-5">
    <ReaderSelects />
    <hr class="border-gray-100 opacity-10" />
    <ReaderToggles />
    <div>
      <Label>Swipe threshold</Label>
      <Range
        on:change={onSwipeChange}
        min={20}
        max={90}
        disabled={!$settings.mobile}
        bind:value={swipeThresholdValue}
      />
    </div>
    <div>
      <Label>Edge button width</Label>
      <Range on:change={onWidthChange} min={1} max={100} bind:value={edgeButtonWidthValue} />
    </div>
    <div>
      <Label>Color Temperature</Label>
      <Range on:change={onColorTempChange} min={0} max={200} bind:value={colorTemperatureValue} />
    </div>
  </div>
</AccordionItem>