<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { draggable } from '$lib/actions/draggable';
  import { anchored } from '$lib/actions/anchored';
  import { t, fmt } from '$lib/i18n';
  import type { ScheduleSlot, Subject, Topic } from '$lib/types';

  export let slot: ScheduleSlot;
  export let subject: Subject | undefined = undefined;
  export let topic: Topic | undefined = undefined;
  export let subjects: Subject[] = [];
  /** True when this block is in a narrow column (2+ overlapping blocks).
   *  Hides the topic label to reduce clutter. */
  export let isNarrow = false;

  const dispatch = createEventDispatcher<{
    accept: { slotId: string };
    dismiss: { slotId: string };
    delete: { slotId: string };
    startFocus: { slot: ScheduleSlot };
    dragStart: { slot: ScheduleSlot };
    dragMove: { dy: number; clientX: number };
    dragEnd: void;
    resizeStart: { slot: ScheduleSlot };
    resizeMove: { dy: number };
    resizeEnd: void;
    changeSubject: { slotId: string; subjectId: string | undefined };
  }>();

  let showPopover = false;
  let didDrag = false;
  let lifting = false;
  let dragDx = 0;
  let dragDy = 0;
  // Velocity-based squash & stretch — the "soft body" deformation while dragging.
  let velX = 0;
  let velY = 0;
  let prevDx = 0;
  let prevDy = 0;
  let relaxTimer: ReturnType<typeof setTimeout> | null = null;

  $: jellySkewX = Math.max(-7, Math.min(7, velX * 0.35));
  $: jellySkewY = Math.max(-5, Math.min(5, velY * 0.25));
  $: jellyStretch = Math.min(0.06, Math.hypot(velX, velY) * 0.004);
  $: liftTransform = lifting
    ? `translateY(-3px) scale(${(1.05 + jellyStretch).toFixed(4)}, ${(1.05 - jellyStretch).toFixed(4)}) skew(${jellySkewX.toFixed(2)}deg, ${jellySkewY.toFixed(2)}deg)`
    : '';

  function relaxJelly() {
    velX = 0;
    velY = 0;
  }
  let blockEl: HTMLElement;

  $: isShort = (() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return (end.getTime() - start.getTime()) / 60000 < 30;
  })();

  $: timeLabel = `${$fmt.date(slot.startTime, { hour: 'numeric', minute: '2-digit' })} – ${$fmt.date(slot.endTime, { hour: 'numeric', minute: '2-digit' })}`;

  $: durationLabel = (() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const min = Math.round((end.getTime() - start.getTime()) / 60000);
    return min >= 60
      ? `${Math.floor(min / 60)}${$t.schedule.unitH}${min % 60 ? ` ${min % 60}${$t.schedule.unitM}` : ''}`
      : `${min}${$t.schedule.unitM}`;
  })();

  /**
   * Returns a readable foreground color for a solid subject-color background.
   * The block background is the subject's fixed color (theme-independent), so
   * the text must be an ABSOLUTE near-black / near-white chosen from that
   * color's luminance — never a theme token like var(--bg)/var(--text), which
   * would invert in dark mode and make blocks unreadable. This luminance helper
   * is the one sanctioned place for absolute colors (it contrasts against a
   * non-token background).
   */
  function contrastColor(hex: string): string {
    // Strip leading # and handle 3/6 digit forms.
    const h = hex.replace(/^#/, '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (full.length !== 6) return '#ffffff'; // fallback for non-hex: white reads on typical subject colors
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    // WCAG relative luminance
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    // Pure black/white at the WCAG crossover threshold (0.179) — this maximises
    // the minimum contrast ratio, guaranteeing >=4.58:1 (AA for normal text)
    // against ANY background color. A higher threshold or a near-black like
    // #1d1d1f drops mid-tone subject colors (teal/blue/amber) below 4.5:1.
    return L > 0.179 ? '#000000' : '#ffffff';
  }

  $: blockBg = subject
    ? (slot.isAiSuggested ? `rgba(${subject.colorRgb}, 0.15)` : subject.color)
    : 'var(--bg3)';
  $: blockBorder = subject
    ? (slot.isAiSuggested ? `1.5px dashed ${subject.color}` : 'none')
    : '1px solid var(--border)';
  $: blockColor = subject
    ? (slot.isAiSuggested ? subject.color : contrastColor(subject.color))
    : 'var(--muted)';

  function onBlockKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBlockClick(); }
  }

  function onBlockClick() {
    if (didDrag) { didDrag = false; return; }
    showPopover = !showPopover;
  }

  const moveDrag = {
    onStart: () => {
      if (!showPopover) {
        lifting = true;
        dragDx = 0; dragDy = 0; prevDx = 0; prevDy = 0; velX = 0; velY = 0;
        dispatch('dragStart', { slot });
      }
    },
    onMove: (d: { dx: number; dy: number; event: PointerEvent }) => {
      if (!showPopover) {
        velX = velX * 0.6 + (d.dx - prevDx) * 0.4;
        velY = velY * 0.6 + (d.dy - prevDy) * 0.4;
        prevDx = d.dx;
        prevDy = d.dy;
        if (relaxTimer) clearTimeout(relaxTimer);
        relaxTimer = setTimeout(relaxJelly, 70);
        dragDx = d.dx;
        dragDy = d.dy;
        dispatch('dragMove', { dy: d.dy, clientX: d.event.clientX });
      }
    },
    onEnd: (d: { dragged: boolean; event: PointerEvent }) => {
      lifting = false;
      dragDx = 0;
      dragDy = 0;
      if (relaxTimer) { clearTimeout(relaxTimer); relaxTimer = null; }
      velX = 0;
      velY = 0;
      if (d.dragged) {
        if (d.event.type !== 'pointercancel') didDrag = true;
        if (!showPopover) dispatch('dragEnd');
      }
    },
  };

  const resizeDrag = {
    onStart: () => dispatch('resizeStart', { slot }),
    onMove: (d: { dy: number }) => dispatch('resizeMove', { dy: d.dy }),
    onEnd: (d: { dragged: boolean; event: PointerEvent }) => {
      if (d.dragged) {
        if (d.event.type !== 'pointercancel') didDrag = true;
        dispatch('resizeEnd');
      }
    },
  };

  function pickSubject(subjectId: string | undefined) {
    dispatch('changeSubject', { slotId: slot.id, subjectId });
    showPopover = false;
  }
</script>

<div
  class="cal-block"
  class:suggested={slot.isAiSuggested}
  class:lifting
  class:focus-block={slot.isFocusBlock && !!subject}
  style="background: {blockBg}; border: {blockBorder}; color: {blockColor}; translate: {dragDx}px {dragDy}px;{liftTransform ? ` transform: ${liftTransform};` : ''}"
  bind:this={blockEl}
  on:click={onBlockClick}
  on:keydown={onBlockKeydown}
  role="button"
  tabindex="0"
  aria-expanded={showPopover}
  use:draggable={moveDrag}
>
  <div class="block-content">
    {#if slot.isFocusBlock && !slot.isAiSuggested && subject}
      <span class="focus-icon" aria-hidden="true">⚡</span>
    {/if}
    <div class="block-label">
      {#if slot.isAiSuggested && subject}<span class="suggest-star">✦ </span>{/if}
      {#if subject}
        <strong>{subject.symbol}</strong>
        {#if !isShort && !isNarrow && topic}<span class="block-topic"> · {topic.name}</span>{/if}
      {:else}
        <span class="free-label">{$t.schedule.free}</span>
      {/if}
    </div>
    {#if !isShort}
      <div class="block-time">{timeLabel}</div>
    {/if}
  </div>

  {#if !slot.isAiSuggested}
    <div class="block-resize" use:draggable={resizeDrag} on:pointerdown|stopPropagation aria-hidden="true"></div>
  {/if}

  {#if showPopover}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="block-popover" use:anchored={{ anchor: blockEl, placement: 'bottom-start', gutter: 6 }} on:click|stopPropagation on:pointerdown|stopPropagation>
      {#if slot.isAiSuggested}
        <div class="pop-title">{$t.schedule.suggestedBy(subject?.name ?? $t.schedule.freeBlock)}</div>
        <div class="pop-time">{timeLabel} · {durationLabel}</div>
        <div class="pop-actions">
          <button class="pop-btn accept" on:click={() => { showPopover = false; dispatch('accept', { slotId: slot.id }); }}>
            {$t.schedule.accept}
          </button>
          <button class="pop-btn dismiss" on:click={() => { showPopover = false; dispatch('dismiss', { slotId: slot.id }); }}>
            {$t.schedule.dismiss}
          </button>
        </div>
      {:else}
        <div class="pop-subject-row">
          {#if subject}
            <span class="pop-subject-dot" style="background: {subject.color};"></span>
            <span class="pop-title">{subject.name}</span>
          {:else}
            <span class="pop-title pop-free">{$t.schedule.freeBlock}</span>
          {/if}
        </div>
        {#if topic}<div class="pop-topic">{topic.name}</div>{/if}
        <div class="pop-time">{timeLabel} · {durationLabel}</div>

        {#if subjects.length > 0}
          <div class="pop-change-label">{$t.schedule.changeSubject}</div>
          <div class="pop-subject-chips">
            <button
              class="pop-chip"
              class:active={!slot.subjectId}
              on:click={() => pickSubject(undefined)}
            >
              <span class="chip-dot muted-dot"></span>
              {$t.schedule.free}
            </button>
            {#each subjects as s}
              <button
                class="pop-chip"
                class:active={slot.subjectId === s.id}
                style="--chip-color: {s.color};"
                on:click={() => pickSubject(s.id)}
              >
                <span class="chip-dot" style="background: {s.color};"></span>
                {s.name}
              </button>
            {/each}
          </div>
        {/if}

        <div class="pop-actions">
          {#if slot.isFocusBlock && subject}
            <button class="pop-btn focus" on:click={() => { showPopover = false; dispatch('startFocus', { slot }); }}>
              {$t.schedule.startFocus}
            </button>
          {/if}
          <button class="pop-btn delete" on:click={() => { showPopover = false; dispatch('delete', { slotId: slot.id }); }}>
            {$t.common.delete}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .cal-block {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 12px;
    cursor: pointer;
    overflow: visible;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    box-sizing: border-box;
    min-height: 15px;
    touch-action: none;
    /* Soft resting shadow — single layer, Apple-style. */
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    /* Spring on transform/translate = the iOS "jelly" pick-up, trailing follow, and settle. */
    transition: transform var(--dur-base) var(--ease-spring), translate 180ms var(--ease-spring), box-shadow 240ms ease, border-radius 240ms ease;
  }
  @media (hover: hover) {
    .cal-block:hover { transform: scale(1.015); box-shadow: 0 3px 12px rgba(0,0,0,0.16); z-index: 5; }
  }
  .cal-block.lifting {
    transform: scale(1.05) translateY(-3px);
    box-shadow: 0 16px 28px rgba(0,0,0,0.30), 0 5px 10px rgba(0,0,0,0.18);
    border-radius: 14px;
    z-index: 10;
    cursor: grabbing;
  }
  .cal-block.lifting .block-content { border-radius: 14px; }
  .block-content {
    position: absolute;
    inset: 0;
    padding: 3px 6px;
    border-radius: 12px;
    overflow: hidden;
    pointer-events: none;
  }
  .cal-block.focus-block {
    border-left: 3px solid color-mix(in srgb, var(--bg) 80%, transparent) !important;
  }
  .focus-icon {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: 10px;
  }
  .block-label {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .suggest-star { opacity: 0.85; }
  /* No opacity on block text — it composites toward the colored background and
     drops contrast below WCAG AA. Hierarchy comes from size/weight instead. */
  .block-topic { font-weight: 400; }
  .free-label { opacity: 0.6; font-weight: 400; }
  .block-time {
    font-size: 10px;
    margin-top: 1px;
    white-space: nowrap;
  }
  .block-resize {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 5px;
    cursor: s-resize;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    touch-action: none;
  }
  .block-resize:hover { background: rgba(0,0,0,0.15); }

  .block-popover {
    z-index: 200;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    min-width: 200px;
    /* Cap the width so many subjects wrap into a tidy grid instead of one
       very long horizontal strip. Clamped to 92vw so it never forces
       horizontal overflow on a 390px phone. */
    max-width: min(280px, 92vw);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    color: var(--text);
  }
  .pop-subject-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }
  .pop-subject-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-title { font-size: 13px; font-weight: 600; }
  .pop-free { color: var(--muted); }
  .pop-topic { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  .pop-time { font-size: 11px; color: var(--muted); margin-bottom: 8px; }

  .pop-change-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: 5px;
  }
  .pop-subject-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
    /* Long subject lists (full TCAS set) scroll instead of growing tall. */
    max-height: 140px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .pop-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 20px;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }
  .pop-chip.active {
    border-color: var(--chip-color, var(--muted));
    background: color-mix(in srgb, var(--chip-color, var(--muted)) 12%, transparent);
    color: var(--chip-color, var(--muted));
  }
  .chip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .muted-dot { background: var(--muted); }

  .pop-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .pop-btn {
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg3);
    color: var(--text);
    cursor: pointer;
  }
  .pop-btn.accept { background: var(--primary); color: var(--bg); border-color: var(--primary); }
  .pop-btn.focus { background: var(--primary); color: var(--bg); border-color: var(--primary); }
  .pop-btn.delete { color: var(--danger); border-color: var(--danger); }
  .pop-btn.dismiss { color: var(--muted); }
  .pop-btn:hover { opacity: 0.85; }
</style>
