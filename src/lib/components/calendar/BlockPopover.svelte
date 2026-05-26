<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Subject, Topic } from '$lib/types';

  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let startTime: string = '';
  export let endTime: string = '';

  const dispatch = createEventDispatcher<{
    save: { subjectId: string; topicId: string | undefined; isFocusBlock: boolean };
    cancel: void;
  }>();

  let selectedSubjectId = subjects[0]?.id ?? '';
  let selectedTopicId = '';
  let isFocusBlock = false;

  $: filteredTopics = topics.filter(t => t.subjectId === selectedSubjectId);
  $: if (selectedSubjectId) selectedTopicId = '';

  $: timeLabel = (() => {
    const fmt = (s: string) => {
      const d = new Date(s);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const start = new Date(startTime);
    const end = new Date(endTime);
    const min = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${fmt(startTime)} – ${fmt(endTime)} (${min}m)`;
  })();

  function save() {
    if (!selectedSubjectId) return;
    dispatch('save', {
      subjectId: selectedSubjectId,
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

<div class="block-popover-create">
  <div class="pop-time-label">{timeLabel}</div>

  <div class="field-label">Subject</div>
  <div class="subject-list">
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
    <div class="field-label" style="margin-top:10px;">Topic (optional)</div>
    <select class="topic-select" bind:value={selectedTopicId}>
      <option value="">— none —</option>
      {#each filteredTopics as t}
        <option value={t.id}>{t.name}</option>
      {/each}
    </select>
  {/if}

  <label class="focus-toggle">
    <input type="checkbox" bind:checked={isFocusBlock} />
    <span>⚡ Focus block</span>
  </label>

  <div class="pop-actions">
    <button class="pop-btn cancel" on:click={() => dispatch('cancel')}>Cancel</button>
    <button class="pop-btn save" disabled={!selectedSubjectId} on:click={save}>Add block</button>
  </div>
</div>

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 150;
  }
  .block-popover-create {
    position: absolute;
    z-index: 160;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    min-width: 220px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.18);
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
  .topic-select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 13px;
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
    color: white;
    border-color: var(--primary);
  }
  .pop-btn.save:disabled { opacity: 0.4; cursor: not-allowed; }
  .pop-btn:not(:disabled):hover { opacity: 0.85; }
</style>
