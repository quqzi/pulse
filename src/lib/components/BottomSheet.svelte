<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();
  function close() { dispatch('close'); }

  let prefersReduced = false;
  onMount(() => { prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; });
  $: dur = prefersReduced ? 0 : 240;

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) { e.stopPropagation(); close(); }
  }

  // swipe-down on the handle area closes the sheet
  let dragging = false;
  let startY = 0;
  let dragY = 0;
  function onPointerdown(e: PointerEvent) {
    dragging = true; startY = e.clientY; dragY = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointermove(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function onPointerup() {
    if (!dragging) return;
    dragging = false;
    if (dragY > 70) close();
    dragY = 0;
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="sheet-backdrop" on:click={close} transition:fade={{ duration: dur }} aria-hidden="true"></div>
  <div
    class="sheet-panel"
    role="dialog"
    aria-modal="true"
    style="transform: translateY({dragY}px);"
    transition:fly={{ y: 400, duration: dur }}
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="sheet-grip"
      on:pointerdown={onPointerdown}
      on:pointermove={onPointermove}
      on:pointerup={onPointerup}
    >
      <button class="sheet-handle" on:click={close} aria-label="Close"></button>
    </div>
    <div class="sheet-content">
      <slot />
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 300;
    background: rgba(0, 0, 0, 0.45);
  }
  .sheet-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 301;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--bg2);
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.25);
    padding-bottom: env(safe-area-inset-bottom);
    color: var(--text);
  }
  .sheet-grip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px 0 6px;
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    padding: 0;
    border: none;
    border-radius: 2px;
    background: var(--border);
    cursor: pointer;
  }
  .sheet-content {
    overflow-y: auto;
    padding: 0 14px 14px;
    min-height: 0;
  }
</style>
