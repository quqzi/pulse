<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { Subject } from '$lib/types';
  import { t } from '$lib/i18n';

  export let open = false;
  export let subject: Subject | null = null;

  const dispatch = createEventDispatcher<{
    save: { name: string; symbol: string; color: string; colorRgb: string };
    delete: void;
    close: void;
  }>();

  // Relocate to <body> so the sheet escapes `.main-content`'s trapped stacking
  // context and renders above the fixed bottom tab-bar (same reason as BottomSheet).
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  type Swatch = (typeof SUBJECT_COLOR_PALETTE)[number];

  let name = '';
  let symbol = '';
  let color: Swatch = SUBJECT_COLOR_PALETTE[0];
  let saving = false;
  let confirmOpen = false;

  // seed the form exactly once on each false→true transition of `open`.
  // Kept in one reactive block: a split `$: if (open && !wasOpen)` / `$: wasOpen = open`
  // lets Svelte order the writer before the reader, so `wasOpen` is already true
  // when the guard runs and seed() never fires.
  let wasOpen = false;
  $: {
    if (open && !wasOpen) seed();
    wasOpen = open;
  }

  function seed() {
    if (subject) {
      name = subject.name;
      symbol = subject.symbol;
      color = SUBJECT_COLOR_PALETTE.find((c) => c.hex === subject.color) ?? {
        hex: subject.color,
        rgb: subject.colorRgb,
      };
    } else {
      name = '';
      symbol = '';
      color = SUBJECT_COLOR_PALETTE[0];
    }
    saving = false;
  }

  // add mode only: auto-derive a 2-char symbol from the name as the user types
  $: if (open && !subject && name) symbol = name.replace(/\s+/g, '').slice(0, 2);

  function close() {
    open = false;
    dispatch('close');
  }

  function save() {
    if (saving || !name.trim()) return;
    saving = true;
    dispatch('save', {
      name: name.trim(),
      symbol: (symbol.replace(/\s+/g, '') || name.replace(/\s+/g, '').slice(0, 2)).slice(0, 2),
      color: color.hex,
      colorRgb: color.rgb,
    });
    close();
  }

  function requestDelete() {
    confirmOpen = true;
  }
  function doDelete() {
    dispatch('delete');
    close();
  }
</script>

<ConfirmDialog
  bind:open={confirmOpen}
  title={$t.subjects.deleteSubjectTitle}
  message={$t.subjects.deleteSubjectMessage}
  on:confirm={doDelete}
/>

{#if open}
  <div use:portal>
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="sheet-overlay" on:click={close} role="presentation" transition:fade={{ duration: 200 }}></div>
  <div
    class="sheet glass-panel"
    role="dialog"
    aria-modal="true"
    aria-label={subject ? $t.subjects.editSubject : $t.subjects.newSubject}
    in:fly={{ y: 380, duration: 420, easing: backOut }}
    out:fly={{ y: 360, duration: 240, easing: cubicOut }}
  >
    <div class="sheet-handle"></div>
    <p class="sheet-title">{subject ? $t.subjects.editSubject : $t.subjects.newSubject}</p>

    <!-- Live preview — the tile updates as you type and pick a colour. -->
    <div class="preview-row">
      <span class="preview-chip" style="background:rgba({color.rgb}, 0.16); color:{color.hex}">{symbol || '?'}</span>
      <span class="preview-name" class:placeholder={!name.trim()}>{name.trim() || $t.subjects.namePlaceholder}</span>
    </div>

    <div class="field">
      <label class="field-label" for="subj-name">{$t.subjects.subjectName}</label>
      <input id="subj-name" class="field-input" bind:value={name} placeholder={$t.subjects.namePlaceholder} />
    </div>

    <div class="field">
      <label class="field-label" for="subj-symbol">{$t.subjects.subjectSymbol} <span class="field-hint">{$t.subjects.symbolHint}</span></label>
      <input id="subj-symbol" class="field-input sym-input" bind:value={symbol} maxlength="2" placeholder={$t.subjects.symbolPlaceholder} />
    </div>

    <div class="field">
      <span class="field-label">{$t.settings.color}</span>
      <div class="color-swatches">
        {#each SUBJECT_COLOR_PALETTE as c}
          <button
            class="swatch"
            class:selected={color.hex === c.hex}
            style="background:{c.hex}"
            on:click={() => (color = c)}
            aria-label={c.hex}
          >
            {#if color.hex === c.hex}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <div class="sheet-actions">
      {#if subject}
        <button class="btn-delete" on:click={requestDelete}>{$t.common.delete}</button>
      {/if}
      <button class="btn-cancel" on:click={close}>{$t.common.cancel}</button>
      <button class="btn-save" on:click={save} disabled={!name.trim() || saving}>{$t.common.save}</button>
    </div>
  </div>
  </div>
{/if}

<style>
  .sheet-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200;
  }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    border-radius: 20px 20px 0 0;
    /* glass-panel supplies bg/blur/shadow; the sheet sits at the viewport edge */
    border: none;
    border-top: 1px solid var(--border);
    border-top: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    padding: 12px 20px 40px; max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
  .preview-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; margin-bottom: 16px;
    background: var(--bg3);
    background: color-mix(in srgb, var(--bg) 55%, transparent);
    border: 1px solid var(--border); border-radius: 14px;
  }
  .preview-chip {
    width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 800;
    transition: background 200ms ease, color 200ms ease, transform var(--dur-base) var(--ease-spring);
  }
  .preview-row:hover .preview-chip { transform: scale(1.08) rotate(-3deg); }
  .preview-name { font-size: 15px; font-weight: 600; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .preview-name.placeholder { color: var(--muted); font-weight: 500; }
  .field { margin-bottom: 16px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .field-input {
    width: 100%; padding: 11px 13px; border: 1.5px solid var(--border);
    border-radius: 12px; background: var(--border); color: var(--text);
    border-radius: 12px; background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  .field-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
  }
  .sym-input { width: 72px; text-align: center; font-weight: 700; }
  .color-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch {
    width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid transparent;
    cursor: pointer; transition: transform var(--dur-base) var(--ease-spring), border-color 150ms ease;
    display: flex; align-items: center; justify-content: center; line-height: 0;
  }
  .swatch:hover { transform: scale(1.12); }
  .swatch.selected { border-color: var(--text); transform: scale(1.18); }
  .sheet-actions { display: flex; gap: 8px; margin-top: 24px; }
  .btn-delete {
    padding: 10px 16px; border-radius: var(--radius-md); border: none;
    background: var(--danger-soft); color: var(--danger); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-cancel {
    flex: 1; padding: 10px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .btn-save {
    flex: 2; padding: 10px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

  @media (max-width: 768px) {
    .swatch { width: 44px; height: 44px; }
  }
</style>
