<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t, fmt } from '$lib/i18n';
  import type { Subject, Topic } from '$lib/types';
  import Picker from '$lib/components/Picker.svelte';

  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let startTime: string = '';
  export let endTime: string = '';

  const dispatch = createEventDispatcher<{
    save: { subjectId: string | undefined; topicId: string | undefined; isFocusBlock: boolean };
    cancel: void;
  }>();

  // Start with no subject selected so user makes a deliberate choice
  let selectedSubjectId: string | null = null;
  let selectedTopicId = '';
  let isFocusBlock = false;

  $: filteredTopics = selectedSubjectId ? topics.filter(tp => tp.subjectId === selectedSubjectId) : [];
  $: if (selectedSubjectId !== null) selectedTopicId = '';

  $: timeLabel = (() => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const min = Math.round((end.getTime() - start.getTime()) / 60000);
    const startStr = $fmt.date(startTime, { hour: '2-digit', minute: '2-digit', hour12: false });
    const endStr = $fmt.date(endTime, { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${startStr} – ${endStr} (${min}${$t.schedule.unitM})`;
  })();

  function save() {
    dispatch('save', {
      subjectId: selectedSubjectId ?? undefined,
      topicId: selectedTopicId || undefined,
      isFocusBlock,
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('cancel');
    if (e.key === 'Enter') save();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="popover-backdrop" on:click={() => dispatch('cancel')}></div>

<div class="block-popover-create glass-panel">
  <div class="pop-time-label">{timeLabel}</div>

  <div class="field-label">{$t.schedule.subject}</div>
  <div class="subject-list">
    <button
      class="subject-chip"
      class:active={selectedSubjectId === null}
      style="--chip-color: var(--muted);"
      on:click={() => selectedSubjectId = null}
    >
      <span class="chip-dot" style="background: var(--muted);"></span>
      {$t.schedule.free}
    </button>
    {#each subjects as subject}
      <button
        class="subject-chip"
        class:active={selectedSubjectId === subject.id}
        style="--chip-color: {subject.color};"
        on:click={() => selectedSubjectId = subject.id}
      >
        <span class="chip-dot" style="background: {subject.color};"></span>
        {subject.name}
      </button>
    {/each}
  </div>

  {#if filteredTopics.length > 0}
    <div class="field-label" style="margin-top:10px;">{$t.schedule.topicOptional}</div>
    <Picker
      bind:value={selectedTopicId}
      options={filteredTopics.map(tp => ({ value: tp.id, label: tp.name }))}
      placeholder={$t.schedule.noneOption}
      ariaLabel={$t.schedule.topicOptional}
    />
  {/if}

  <label class="focus-toggle">
    <input type="checkbox" bind:checked={isFocusBlock} />
    <span>{$t.schedule.focusBlock}</span>
  </label>

  <div class="pop-actions">
    <button class="pop-btn cancel" on:click={() => dispatch('cancel')}>{$t.common.cancel}</button>
    <button class="pop-btn save" on:click={save}>{$t.schedule.addBlock}</button>
  </div>
</div>

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 150;
  }
  .block-popover-create {
    /* In normal flow: the anchored wrapper must measure the popover's real
       height or floating-ui can't flip it away from the viewport edge. */
    position: relative;
    z-index: 160;
    border-radius: 16px;
    padding: 14px 16px;
    min-width: 220px;
    color: var(--text);
  }
  .pop-time-label {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 10px;
    font-weight: 500;
  }
  .field-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .subject-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 2px;
  }
  .subject-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .subject-chip.active {
    border-color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 12%, transparent);
    color: var(--chip-color);
  }
  .chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .focus-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    cursor: pointer;
  }
  .focus-toggle input { cursor: pointer; }
  .pop-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    justify-content: flex-end;
  }
  .pop-btn {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
  }
  .pop-btn.cancel { background: var(--bg3); color: var(--muted); }
  .pop-btn.save {
    background: var(--primary);
    color: var(--bg);
    border-color: var(--primary);
  }
  .pop-btn:hover { opacity: 0.85; }

  :global(body.design-apple) .block-popover-create {
    box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.05);
  }
  :global(body.design-apple.theme-dark) .block-popover-create {
    box-shadow: 0 1px 2px rgba(0,0,0,.30), 0 12px 28px rgba(0,0,0,.40);
  }
  :global(body.design-apple) .subject-chip { border-radius: var(--radius-sm); }
  :global(body.design-apple) .subject-chip.active {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
  }
</style>
