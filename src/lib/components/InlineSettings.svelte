<script lang="ts">
  import { tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import { t } from '$lib/i18n';

  export let label: string;

  let open = false;
  let btnEl: HTMLButtonElement;
  let popEl: HTMLDivElement | null = null;
  let popTop = 0;
  let popLeft = 0;

  // Portal to <body> so the popover escapes trapped stacking contexts
  // (same reason as BottomSheet/ConfirmDialog).
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  async function toggle() {
    open = !open;
    if (!open) return;
    await tick();
    if (!btnEl || !popEl) return;
    const rect = btnEl.getBoundingClientRect();
    const popW = popEl.offsetWidth;
    const popH = popEl.offsetHeight;
    const margin = 8;
    popLeft = Math.max(margin, Math.min(rect.right - popW, window.innerWidth - popW - margin));
    popTop = rect.bottom + margin;
    if (popTop + popH > window.innerHeight - margin) {
      popTop = Math.max(margin, rect.top - popH - margin);
    }
  }

  function onWindowPointerdown(e: PointerEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (popEl?.contains(target) || btnEl?.contains(target)) return;
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) open = false;
  }
</script>

<svelte:window on:pointerdown={onWindowPointerdown} on:keydown={onKeydown} />

<button
  bind:this={btnEl}
  class="gear-btn pressable"
  aria-label={label}
  aria-expanded={open}
  on:click={toggle}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
</button>

{#if open}
  <div use:portal>
    <div
      bind:this={popEl}
      class="pop glass-panel"
      role="dialog"
      tabindex="-1"
      aria-label={label}
      style="top:{popTop}px; left:{popLeft}px;"
      transition:fade={{ duration: 140 }}
      on:pointerdown|stopPropagation
    >
      <div class="pop-head">
        <span class="pop-title">{$t.common.quickSettings}</span>
        <a class="pop-all" href="/settings" on:click={() => (open = false)}>{$t.common.allSettings} ›</a>
      </div>
      <div class="pop-body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .gear-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
    border: 1px solid var(--border); background: var(--bg2); color: var(--muted);
    cursor: pointer;
    transition: background 140ms ease, color 140ms ease;
  }
  .gear-btn:hover { background: var(--bg3); color: var(--text); }
  .gear-btn[aria-expanded="true"] { color: var(--primary); border-color: var(--primary); }
  .pop {
    position: fixed; z-index: 300;
    width: min(300px, calc(100vw - 16px));
    border-radius: var(--radius-md);
    padding: 14px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .pop-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pop-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .pop-all { font-size: 12px; color: var(--primary); text-decoration: none; white-space: nowrap; }
  .pop-all:hover { text-decoration: underline; }
  .pop-body { display: flex; flex-direction: column; gap: 10px; }
</style>
