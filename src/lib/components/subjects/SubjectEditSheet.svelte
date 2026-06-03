<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { Subject } from '$lib/types';

  export let open = false;
  export let subject: Subject | null = null;

  const dispatch = createEventDispatcher<{
    save: { name: string; symbol: string; color: string; colorRgb: string };
    delete: void;
    close: void;
  }>();

  type Swatch = { hex: string; rgb: string };

  let name = '';
  let symbol = '';
  let color: Swatch = SUBJECT_COLOR_PALETTE[0];
  let saving = false;
  let confirmOpen = false;

  // seed the form exactly once on each false→true transition of `open`
  let wasOpen = false;
  $: if (open && !wasOpen) seed();
  $: wasOpen = open;

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
      symbol: (symbol || name.slice(0, 2)).slice(0, 2),
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
  title="Delete subject?"
  message="All its topics and SRS cards will also be deleted. This cannot be undone."
  on:confirm={doDelete}
/>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="sheet-overlay" on:click={close} role="presentation"></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <p class="sheet-title">{subject ? 'Edit Subject' : 'New Subject'}</p>

    <div class="field">
      <label class="field-label" for="subj-name">Name</label>
      <input id="subj-name" class="field-input" bind:value={name} placeholder="e.g. Physics" />
    </div>

    <div class="field">
      <label class="field-label" for="subj-symbol">Symbol <span class="field-hint">(2 chars)</span></label>
      <input id="subj-symbol" class="field-input sym-input" bind:value={symbol} maxlength="2" placeholder="Ph" />
    </div>

    <div class="field">
      <span class="field-label">Color</span>
      <div class="color-swatches">
        {#each SUBJECT_COLOR_PALETTE as c}
          <button
            class="swatch"
            class:selected={color.hex === c.hex}
            style="background:{c.hex}"
            on:click={() => (color = c)}
            aria-label={c.hex}
          ></button>
        {/each}
      </div>
    </div>

    <div class="sheet-actions">
      {#if subject}
        <button class="btn-delete" on:click={requestDelete}>Delete</button>
      {/if}
      <button class="btn-cancel" on:click={close}>Cancel</button>
      <button class="btn-save" on:click={save} disabled={!name.trim() || saving}>Save</button>
    </div>
  </div>
{/if}

<style>
  .sheet-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200;
  }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    background: var(--bg2); border-radius: 20px 20px 0 0;
    padding: 12px 20px 40px; max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
  .field { margin-bottom: 16px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .field-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid var(--border);
    border-radius: var(--radius-md); background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--primary); }
  .sym-input { width: 72px; text-align: center; font-weight: 700; }
  .color-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch {
    width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid transparent;
    cursor: pointer; transition: transform 100ms ease;
  }
  .swatch.selected { border-color: var(--text); transform: scale(1.15); }
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
