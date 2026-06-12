<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';

  interface PickerOption {
    value: string;
    label: string;
    color?: string;
  }

  export let value: string = '';
  export let options: PickerOption[] = [];
  export let placeholder = '';
  export let disabled = false;
  export let ariaLabel = '';

  const dispatch = createEventDispatcher<{ change: { value: string } }>();

  let open = false;

  $: selected = options.find(o => o.value === value);

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  function pick(v: string) {
    value = v;
    open = false;
    dispatch('change', { value: v });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) { e.stopPropagation(); open = false; }
  }
</script>

<svelte:window on:keydown={onKeydown} />

<button
  type="button"
  class="picker-trigger"
  class:placeholder={!selected}
  {disabled}
  aria-label={ariaLabel || placeholder}
  aria-haspopup="listbox"
  aria-expanded={open}
  style={selected?.color ? `color: ${selected.color};` : ''}
  on:click={() => (open = true)}
>
  <span class="trigger-label">{selected ? selected.label : placeholder}</span>
  <svg class="chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
  </svg>
</button>

{#if open}
  <div use:portal>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="picker-backdrop" transition:fade={{ duration: 160 }} on:click={() => (open = false)}></div>
    <div
      class="picker-panel"
      role="listbox"
      aria-label={ariaLabel || placeholder}
      transition:scale={{ start: 0.88, duration: 320, easing: backOut }}
    >
      {#if placeholder}
        <div class="panel-title">{placeholder}</div>
      {/if}
      <div class="panel-options">
        {#if placeholder}
          <button type="button" class="panel-option" class:active={!value} role="option" aria-selected={!value} on:click={() => pick('')}>
            <span class="opt-label muted">{placeholder}</span>
            {#if !value}<span class="opt-check">✓</span>{/if}
          </button>
        {/if}
        {#each options as o (o.value)}
          <button
            type="button"
            class="panel-option"
            class:active={o.value === value}
            role="option"
            aria-selected={o.value === value}
            on:click={() => pick(o.value)}
          >
            {#if o.color}<span class="opt-dot" style="background: {o.color};"></span>{/if}
            <span class="opt-label">{o.label}</span>
            {#if o.value === value}<span class="opt-check">✓</span>{/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 9px 12px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    min-width: 0;
    transition: transform var(--dur-base) var(--ease-spring), border-color 160ms ease, filter 160ms ease;
  }
  .picker-trigger:hover:not(:disabled) { transform: scaleX(1.02) scaleY(1.06); border-color: var(--muted); filter: brightness(0.97); }
  .picker-trigger:active:not(:disabled) { transform: scale(0.96); transition-duration: var(--dur-fast); }
  .picker-trigger:disabled { opacity: 0.5; cursor: not-allowed; }
  .picker-trigger.placeholder { color: var(--muted); }
  .trigger-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chevron { flex-shrink: 0; }

  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 400;
    background: rgba(0, 0, 0, 0.26);
  }
  .picker-panel {
    position: fixed;
    left: 50%;
    top: 50%;
    translate: -50% -50%;
    z-index: 401;
    width: min(320px, calc(100vw - 48px));
    max-height: min(420px, 70vh);
    display: flex;
    flex-direction: column;
    background: color-mix(in srgb, var(--bg2) 62%, transparent);
    backdrop-filter: blur(28px) saturate(1.7);
    -webkit-backdrop-filter: blur(28px) saturate(1.7);
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    border-radius: 22px;
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 color-mix(in srgb, var(--text) 10%, transparent),
      inset 0 0 24px color-mix(in srgb, var(--bg) 18%, transparent);
    padding: 8px;
    color: var(--text);
  }
  .panel-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    padding: 8px 12px 6px;
  }
  .panel-options { overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .panel-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 12px;
    border: none;
    border-radius: 11px;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 120ms ease, transform var(--dur-base) var(--ease-spring);
  }
  .panel-option:hover { background: color-mix(in srgb, var(--text) 8%, transparent); }
  .panel-option:active { transform: scale(0.97); transition-duration: var(--dur-fast); }
  .panel-option.active { background: var(--primary-l); color: var(--primary); font-weight: 600; }
  .opt-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .opt-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .opt-label.muted { color: var(--muted); }
  .opt-check { flex-shrink: 0; font-weight: 700; }
</style>
