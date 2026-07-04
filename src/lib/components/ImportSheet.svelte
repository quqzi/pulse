<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { t } from '$lib/i18n';
  import type { ImportResult } from '$lib/import';

  export let open = false;
  export let prompt: string;
  export let parse: (text: string) => ImportResult<unknown>;
  export let preview: (item: unknown) => { title: string; sub?: string } = (item) => ({ title: String(item) });
  export let isDuplicate: (item: unknown) => boolean = () => false;

  const dispatch = createEventDispatcher<{ import: { items: unknown[] }; close: void }>();

  let text = '';
  let copied = false;
  let promptVisible = false;
  let checked: boolean[] = [];
  // The user may hand-edit the prompt; re-sync whenever the built prompt
  // changes (count/difficulty/subject controls) so the controls stay live.
  let editedPrompt = prompt;
  $: editedPrompt = prompt;

  $: result = text.trim() ? parse(text) : null;
  $: checked = result?.ok ? result.items.map((item) => !isDuplicate(item)) : [];
  $: selectedItems = result?.ok ? result.items.filter((_, i) => checked[i]) : [];
  $: selectedCount = selectedItems.length;

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
    if (!result?.ok || selectedCount === 0) return;
    dispatch('import', { items: selectedItems });
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
    {#if result.skipped > 0}
      <p class="parse-msg warning">{$t.importer.skippedCount(result.skipped)}</p>
    {/if}
    <div class="preview-head">
      <span>{$t.importer.selectedCount(selectedCount, result.items.length)}</span>
    </div>
    <div class="preview-list">
      {#each result.items as item, i}
        {@const meta = preview(item)}
        {@const duplicate = isDuplicate(item)}
        <label class="preview-row" class:duplicate={duplicate}>
          <input type="checkbox" bind:checked={checked[i]} />
          <span class="preview-copy">
            <span class="preview-title">{meta.title}</span>
            {#if meta.sub}<span class="preview-sub">{meta.sub}</span>{/if}
          </span>
          {#if duplicate}<span class="duplicate-badge">{$t.importer.duplicate}</span>{/if}
        </label>
      {/each}
    </div>
  {/if}

  <button class="import-btn pressable" disabled={!result?.ok || selectedCount === 0} on:click={doImport}>
    {result?.ok ? $t.importer.importN(selectedCount) : $t.importer.importBtn}
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
  .parse-msg.warning { color: var(--muted); }
  .preview-head {
    display: flex; justify-content: space-between; align-items: center;
    margin: 10px 0 6px; font-size: 12px; color: var(--muted); font-weight: 600;
  }
  .preview-list {
    max-height: 240px; overflow-y: auto; border: 1px solid var(--border);
    border-radius: 10px; background: var(--bg); margin-top: 6px;
  }
  .preview-row {
    display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 10px;
    border-bottom: 1px solid var(--border); cursor: pointer;
  }
  .preview-row:last-child { border-bottom: none; }
  .preview-row.duplicate { background: var(--bg2); }
  .preview-row input { flex-shrink: 0; accent-color: var(--primary); }
  .preview-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .preview-title, .preview-sub {
    display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .preview-title { font-size: 13px; color: var(--text); font-weight: 600; }
  .preview-sub { font-size: 12px; color: var(--muted); }
  .duplicate-badge {
    flex-shrink: 0; border: 1px solid var(--border); border-radius: 999px;
    padding: 2px 7px; color: var(--muted); font-size: 10px; font-weight: 700;
    text-transform: uppercase;
  }
  .import-btn {
    width: 100%; margin-top: 12px; padding: 12px; border-radius: 10px; border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px;
    font-weight: 600; cursor: pointer; min-height: 44px;
  }
  .import-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
