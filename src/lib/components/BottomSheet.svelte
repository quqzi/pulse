<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { t } from '$lib/i18n';

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();
  function close() { dispatch('close'); }

  // The page lives inside `.main-content`, whose page-enter animation + scroll
  // container traps descendant z-index. Without this the fixed `.tab-bar`
  // (its own backdrop-filter stacking context) paints over the sheet's lower
  // buttons. Relocating to <body> puts the sheet in the root stacking context.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  let prefersReduced = false;
  // Desktop renders as a centered dialog — no drag transform, gentler motion.
  let isDesktop = false;
  onMount(() => {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mq = window.matchMedia('(min-width: 768px)');
    isDesktop = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (isDesktop = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
  $: dur = prefersReduced ? 0 : 240;
  $: flyInY = isDesktop ? 12 : 420;
  $: flyOutY = isDesktop ? 8 : 400;

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
  <div use:portal>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="sheet-backdrop" on:click={close} transition:fade={{ duration: dur }} aria-hidden="true"></div>
    <div
      class="sheet-panel glass-panel"
      role="dialog"
      aria-modal="true"
      class:settling={!dragging}
      style={isDesktop ? '' : `transform: translateY(${dragY}px);`}
      in:fly={{ y: flyInY, duration: prefersReduced ? 0 : isDesktop ? 240 : 420, easing: backOut }}
      out:fly={{ y: flyOutY, duration: dur, easing: cubicOut }}
    >
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="sheet-grip"
        on:pointerdown={onPointerdown}
        on:pointermove={onPointermove}
        on:pointerup={onPointerup}
      >
        <button class="sheet-handle" on:click={close} aria-label={$t.common.close}></button>
      </div>
      <div class="sheet-content">
        <slot />
      </div>
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
    /* top edge only — the sheet's sides and bottom sit at the viewport edge */
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    border-radius: 20px 20px 0 0;
    box-shadow:
      0 -8px 32px rgba(0, 0, 0, 0.22),
      inset 0 1px 0 color-mix(in srgb, var(--text) 10%, transparent);
    padding-bottom: env(safe-area-inset-bottom);
    color: var(--text);
  }
  /* After a released swipe the sheet springs back up — rubber-band feel.
     No transition while dragging so it tracks the finger 1:1. */
  .sheet-panel.settling { transition: transform 320ms var(--ease-spring); }
  .sheet-grip {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px 0 6px;
    min-height: 44px;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
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

  /* Desktop: centered dialog instead of an edge-to-edge bottom drawer.
     The drag inline transform is disabled in script when isDesktop, so the
     centering translate below is never overridden. */
  @media (min-width: 768px) {
    .sheet-panel {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(560px, calc(100vw - 48px));
      max-height: min(80vh, 720px);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
      padding-bottom: 0;
    }
    .sheet-grip { display: none; }
    .sheet-content { padding: 20px 20px 20px; }
  }
</style>
