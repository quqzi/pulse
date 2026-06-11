<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { t } from '$lib/i18n';
  import type { ImportResult } from '$lib/import';

  export let open = false;
  export let prompt: string;
  export let parse: (text: string) => ImportResult<unknown>;

  const dispatch = createEventDispatcher<{ import: { items: unknown[] }; close: void }>();

  let text = '';
  let copied = false;
  let promptVisible = false;
  // The user may hand-edit the prompt; re-sync whenever the built prompt
  // changes (count/difficulty/subject controls) so the controls stay live.
  let editedPrompt = prompt;
  $: editedPrompt = prompt;

  $: result = text.trim() ? parse(text) : null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(editedPrompt);
    } catch {
      // Clipboard API unavailable (permissions/insecure context) — legacy path.
      const ta = document.createElement('textarea');
      ta.value = editedPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copied = true;
    setTimeout(() => (copied = false), 1600);
  }

  function doImport() {
    if (!result?.ok) return;
    dispatch('import', { items: result.items });
    text = '';
  }

  function close() {
    text = '';
    promptVisible = false;
    dispatch('close');
  }
</script>

<BottomSheet bind:open on:close={close}>
  <h3 class="import-title">{$t.importer.title}</h3>

  <p class="step"><span class="step-num">1</span>{$t.importer.step1}</p>
  <slot name="options" />
  <div class="prompt-row">
    <button class="copy-btn pressable" on:click={copyPrompt}>
      {copied ? $t.importer.copied : $t.importer.copyPrompt}
    </button>
    <button class="peek-btn" class:active={promptVisible} on:click={() => (promptVisible = !promptVisible)} aria-expanded={promptVisible}>
      {$t.importer.showPrompt}
    </button>
  </div>
  {#if promptVisible}
    <textarea class="prompt-area" rows="7" bind:value={editedPrompt} aria-label={$t.importer.showPrompt}></textarea>
  {/if}

  <p class="step"><span class="step-num">2</span>{$t.importer.step2}</p>
  <textarea
    class="paste-area"
    rows="6"
    bind:value={text}
    placeholder={$t.importer.pastePlaceholder}
  ></textarea>

  {#if result && !result.ok}
    <p class="parse-msg error">
      {result.error === 'no-valid-items' ? $t.importer.errNoItems : $t.importer.errInvalid}
    </p>
  {:else if result?.ok}
    <p class="parse-msg ok">{$t.importer.itemsReady(result.items.length)}</p>
  {/if}

  <button class="import-btn pressable" disabled={!result?.ok} on:click={doImport}>
    {result?.ok ? $t.importer.importN(result.items.length) : $t.importer.importBtn}
  </button>
</BottomSheet>

<style>
  .import-title { font-size: 16px; font-weight: 700; color: var(--text); margin: 4px 0 12px; }
  .step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); margin: 12px 0 8px; }
  .step-num {
    width: 20px; height: 20px; border-radius: 50%; background: var(--primary-l); color: var(--primary);
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .prompt-row { display: flex; gap: 8px; }
  .copy-btn {
    flex: 1; padding: 10px; border-radius: 10px; border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 13px;
    font-weight: 600; cursor: pointer; min-height: 44px;
  }
  .copy-btn:hover { opacity: 0.85; }
  .peek-btn {
    padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border);
    background: var(--bg); color: var(--muted); font-family: inherit; font-size: 12px;
    font-weight: 600; cursor: pointer; min-height: 44px; flex-shrink: 0;
  }
  .peek-btn:hover, .peek-btn.active { color: var(--text); background: var(--bg3); }
  .prompt-area {
    width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px; border-radius: 10px;
    border: 1.5px solid var(--border); background: var(--bg); color: var(--text);
    font-family: var(--font-mono, monospace); font-size: 11px; line-height: 1.5; resize: vertical; outline: none;
  }
  .prompt-area:focus { border-color: var(--primary); }
  .paste-area {
    width: 100%; box-sizing: border-box; padding: 10px; border-radius: 10px;
    border: 1.5px solid var(--border); background: var(--bg); color: var(--text);
    font-family: var(--font-mono, monospace); font-size: 12px; resize: vertical; outline: none;
  }
  .paste-area:focus { border-color: var(--primary); }
  .parse-msg { font-size: 12px; margin: 8px 0 0; }
  .parse-msg.error { color: var(--danger); }
  .parse-msg.ok { color: var(--primary); font-weight: 600; }
  .import-btn {
    width: 100%; margin-top: 12px; padding: 12px; border-radius: 10px; border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px;
    font-weight: 600; cursor: pointer; min-height: 44px;
  }
  .import-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
