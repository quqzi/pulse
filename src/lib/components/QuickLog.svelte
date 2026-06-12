<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import Picker from '$lib/components/Picker.svelte';
  import type { Subject, Topic } from '$lib/types';

  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];

  const dispatch = createEventDispatcher<{
    log: { subjectId: string; topicId: string | undefined; durationMin: number }
  }>();

  let selectedSubjectId = '';
  let selectedTopicId = '';
  let durationMin = 30;
  let submitting = false;
  let done = false;

  $: subjectTopics = topics.filter(tp => tp.subjectId === selectedSubjectId);
  $: selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  async function submit() {
    if (!selectedSubjectId || durationMin < 1) return;
    submitting = true;
    dispatch('log', {
      subjectId: selectedSubjectId,
      topicId: selectedTopicId || undefined,
      durationMin,
    });
    done = true;
    submitting = false;
    setTimeout(() => {
      done = false;
      selectedSubjectId = '';
      selectedTopicId = '';
      durationMin = 30;
    }, 1500);
  }
</script>

<section class="quick-section">
  <div class="section-label">{$t.dashboard.quickLog}</div>
  <div class="quick-card card" class:done>
    {#if done}
      <div class="done-state">
        <span class="check-badge">
          <span class="pulse-ring" aria-hidden="true"></span>
          <svg class="check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </span>
        <span>{$t.dashboard.logged}</span>
      </div>
    {:else}
      <div class="form-row">
        <Picker
          bind:value={selectedSubjectId}
          options={subjects.map(s => ({ value: s.id, label: s.name, color: s.color }))}
          placeholder={$t.dashboard.subjectField}
        />
        <Picker
          bind:value={selectedTopicId}
          options={subjectTopics.map(tp => ({ value: tp.id, label: tp.name }))}
          placeholder={$t.dashboard.topicField}
          disabled={!selectedSubjectId}
        />
      </div>
      <div class="form-row">
        <div class="dur-pills" role="group" aria-label={$t.common.minutes}>
          {#each [15, 30, 45, 60] as m}
            <button
              class="dur-pill"
              class:active={durationMin === m}
              on:click={() => (durationMin = m)}
            >{m}</button>
          {/each}
        </div>
      </div>
      <div class="form-row">
        <div class="duration-row">
          <input
            type="number"
            min="1"
            max="720"
            bind:value={durationMin}
            class="field-input duration-input"
            aria-label={$t.common.minutes}
          />
          <span class="dur-label">{$t.common.minutes}</span>
        </div>
        <button
          class="log-btn btn-primary"
          disabled={!selectedSubjectId || durationMin < 1 || submitting}
          on:click={submit}
        >
          {$t.dashboard.logBtn}
        </button>
      </div>
    {/if}
  </div>
</section>

<style>
  .quick-section { margin-top: 24px; }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
    padding: 0 2px;
  }
  .quick-card { padding: 14px; }
  .form-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  .form-row:last-child { margin-bottom: 0; }
  .form-row > :global(.picker-trigger) { flex: 1; }
  /* iOS segmented duration pills — springy selection. */
  .dur-pills { display: flex; gap: 6px; flex: 1; }
  .dur-pill {
    flex: 1;
    padding: 8px 0;
    border-radius: 10px;
    border: 1.5px solid var(--border);
    background: var(--bg3);
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease-spring), background 160ms ease, color 160ms ease, border-color 160ms ease;
  }
  .dur-pill:active { transform: scale(0.92); transition-duration: var(--dur-fast); }
  .dur-pill.active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--bg);
    transform: scale(1.04);
  }
  .duration-row { display: flex; align-items: center; gap: 6px; flex: 1; }
  .duration-input {
    width: 72px;
    padding: 9px 10px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    outline: none;
    text-align: center;
  }
  .duration-input:focus { border-color: var(--primary); }
  .dur-label { font-size: 13px; color: var(--muted); }
  .log-btn {
    padding: 9px 22px;
    border-radius: 10px;
    background: var(--primary);
    color: var(--bg);
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .log-btn:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .log-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .done-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 8px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--primary);
  }
  .check-badge {
    position: relative;
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--primary) 14%, transparent);
    color: var(--primary);
    animation: badge-pop var(--dur-base) var(--ease-spring);
  }
  .check { display: block; }
  .check path {
    stroke-dasharray: 24;
    stroke-dashoffset: 0;
    animation: check-draw 360ms var(--ease-out) 100ms backwards;
  }
  .pulse-ring {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid var(--primary);
    opacity: 0;
    animation: ring-pulse 640ms var(--ease-out);
  }
  @keyframes badge-pop {
    0%   { transform: scale(0); }
    60%  { transform: scale(1.12); }
    100% { transform: scale(1); }
  }
  @keyframes check-draw {
    from { stroke-dashoffset: 24; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes ring-pulse {
    0%   { opacity: 0.55; transform: scale(0.6); }
    100% { opacity: 0; transform: scale(2.1); }
  }

  @media (max-width: 768px) {
    .form-row > :global(.picker-trigger) { min-height: 44px; }
    .duration-input { min-height: 44px; }
    .log-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  }
</style>
