<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { draggable } from '$lib/actions/draggable';
  import type { ScheduleSlot, Subject, Topic } from '$lib/types';

  export let slot: ScheduleSlot;
  export let subject: Subject | undefined = undefined;
  export let topic: Topic | undefined = undefined;
  export let subjects: Subject[] = [];

  const dispatch = createEventDispatcher<{
    accept: { slotId: string };
    dismiss: { slotId: string };
    delete: { slotId: string };
    startFocus: { slot: ScheduleSlot };
    dragStart: { slot: ScheduleSlot };
    dragMove: { dy: number };
    dragEnd: void;
    resizeStart: { slot: ScheduleSlot };
    resizeMove: { dy: number };
    resizeEnd: void;
    changeSubject: { slotId: string; subjectId: string | undefined };
  }>();

  let showPopover = false;
  let didDrag = false;

  $: isShort = (() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return (end.getTime() - start.getTime()) / 60000 < 30;
  })();

  $: timeLabel = (() => {
    const fmt = (s: string) => {
      const d = new Date(s);
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'pm' : 'am';
      return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
    };
    return `${fmt(slot.startTime)} – ${fmt(slot.endTime)}`;
  })();

  $: durationLabel = (() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    const min = Math.round((end.getTime() - start.getTime()) / 60000);
    return min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`;
  })();

  $: blockBg = subject
    ? (slot.isAiSuggested ? `rgba(${subject.colorRgb}, 0.15)` : subject.color)
    : 'var(--bg3)';
  $: blockBorder = subject
    ? (slot.isAiSuggested ? `1.5px dashed ${subject.color}` : 'none')
    : '1px solid var(--border)';
  $: blockColor = subject
    ? (slot.isAiSuggested ? subject.color : 'white')
    : 'var(--muted)';

  function onBlockClick() {
    if (didDrag) { didDrag = false; return; }
    showPopover = !showPopover;
  }

  const moveDrag = {
    onStart: () => { if (!showPopover) dispatch('dragStart', { slot }); },
    onMove: (d: { dy: number }) => { if (!showPopover) dispatch('dragMove', { dy: d.dy }); },
    onEnd: (d: { dragged: boolean; event: PointerEvent }) => {
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

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="cal-block"
  class:suggested={slot.isAiSuggested}
  class:focus-block={slot.isFocusBlock && !!subject}
  style="background: {blockBg}; border: {blockBorder}; color: {blockColor};"
  on:click={onBlockClick}
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
        {#if !isShort && topic}<span class="block-topic"> · {topic.name}</span>{/if}
      {:else}
        <span class="free-label">Free</span>
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
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="block-popover" on:click|stopPropagation>
      {#if slot.isAiSuggested}
        <div class="pop-title">Suggested · {subject?.name ?? 'Free block'}</div>
        <div class="pop-time">{timeLabel} · {durationLabel}</div>
        <div class="pop-actions">
          <button class="pop-btn accept" on:click={() => { showPopover = false; dispatch('accept', { slotId: slot.id }); }}>
            ✓ Accept
          </button>
          <button class="pop-btn dismiss" on:click={() => { showPopover = false; dispatch('dismiss', { slotId: slot.id }); }}>
            ✕ Dismiss
          </button>
        </div>
      {:else}
        <div class="pop-subject-row">
          {#if subject}
            <span class="pop-subject-dot" style="background: {subject.color};"></span>
            <span class="pop-title">{subject.name}</span>
          {:else}
            <span class="pop-title pop-free">Free block</span>
          {/if}
        </div>
        {#if topic}<div class="pop-topic">{topic.name}</div>{/if}
        <div class="pop-time">{timeLabel} · {durationLabel}</div>

        {#if subjects.length > 0}
          <div class="pop-change-label">Change subject</div>
          <div class="pop-subject-chips">
            <button
              class="pop-chip"
              class:active={!slot.subjectId}
              on:click={() => pickSubject(undefined)}
            >
              <span class="chip-dot muted-dot"></span>
              Free
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
              ⚡ Start focus
            </button>
          {/if}
          <button class="pop-btn delete" on:click={() => { showPopover = false; dispatch('delete', { slotId: slot.id }); }}>
            Delete
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
    border-radius: var(--radius-md);
    cursor: pointer;
    overflow: visible;
    user-select: none;
    box-sizing: border-box;
    min-height: 15px;
    touch-action: none;
  }
  .block-content {
    position: absolute;
    inset: 0;
    padding: 3px 6px;
    border-radius: var(--radius-md);
    overflow: hidden;
    pointer-events: none;
  }
  .cal-block.focus-block {
    border-left: 3px solid rgba(255,255,255,0.8) !important;
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
  .block-topic { font-weight: 400; opacity: 0.85; }
  .free-label { opacity: 0.6; font-weight: 400; }
  .block-time {
    font-size: 10px;
    opacity: 0.8;
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
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 200;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    min-width: 200px;
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
