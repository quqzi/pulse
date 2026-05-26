<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ScheduleSlot, Subject, Topic } from '$lib/types';

  export let slot: ScheduleSlot;
  export let subject: Subject;
  export let topic: Topic | undefined = undefined;

  const dispatch = createEventDispatcher<{
    accept: { slotId: string };
    dismiss: { slotId: string };
    delete: { slotId: string };
    startFocus: { slot: ScheduleSlot };
    dragStart: { slot: ScheduleSlot; event: MouseEvent };
    resizeStart: { slot: ScheduleSlot; event: MouseEvent };
  }>();

  let showPopover = false;

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

  function onBlockClick(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.block-resize')) return;
    showPopover = !showPopover;
  }

  function onMousedown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.block-resize')) return;
    if (showPopover) return;
    dispatch('dragStart', { slot, event: e });
  }

  function onResizeMousedown(e: MouseEvent) {
    e.stopPropagation();
    dispatch('resizeStart', { slot, event: e });
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="cal-block"
  class:suggested={slot.isAiSuggested}
  class:focus-block={slot.isFocusBlock}
  style="background: {slot.isAiSuggested ? `rgba(${subject.colorRgb}, 0.15)` : subject.color};
         border: {slot.isAiSuggested ? `1.5px dashed ${subject.color}` : 'none'};
         color: {slot.isAiSuggested ? subject.color : 'white'};"
  on:click={onBlockClick}
  on:mousedown={onMousedown}
>
  {#if slot.isFocusBlock && !slot.isAiSuggested}
    <span class="focus-icon" aria-hidden="true">⚡</span>
  {/if}
  <div class="block-label">
    {#if slot.isAiSuggested}<span class="suggest-star">✦ </span>{/if}
    <strong>{subject.symbol}</strong>
    {#if !isShort && topic}<span class="block-topic"> · {topic.name}</span>{/if}
  </div>
  {#if !isShort}
    <div class="block-time">{timeLabel}</div>
  {/if}

  {#if !slot.isAiSuggested}
    <div class="block-resize" on:mousedown={onResizeMousedown} aria-hidden="true"></div>
  {/if}

  {#if showPopover}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="block-popover" on:click|stopPropagation>
      {#if slot.isAiSuggested}
        <div class="pop-title">Suggested · {subject.name}</div>
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
        <div class="pop-title">{subject.name}</div>
        {#if topic}<div class="pop-topic">{topic.name}</div>{/if}
        <div class="pop-time">{timeLabel} · {durationLabel}</div>
        <div class="pop-actions">
          {#if slot.isFocusBlock}
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
    position: absolute;
    left: 3px;
    right: 3px;
    border-radius: var(--radius-md);
    padding: 3px 6px;
    cursor: pointer;
    overflow: hidden;
    user-select: none;
    box-sizing: border-box;
    min-height: 15px;
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
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    color: var(--text);
  }
  .pop-title { font-size: 13px; font-weight: 600; margin-bottom: 2px; }
  .pop-topic { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  .pop-time { font-size: 11px; color: var(--muted); margin-bottom: 8px; }
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
  .pop-btn.accept { background: var(--primary); color: white; border-color: var(--primary); }
  .pop-btn.focus { background: var(--primary); color: white; border-color: var(--primary); }
  .pop-btn.delete { color: #ef4444; border-color: #ef4444; }
  .pop-btn.dismiss { color: var(--muted); }
  .pop-btn:hover { opacity: 0.85; }
</style>
