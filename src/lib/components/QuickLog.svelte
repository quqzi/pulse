<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <span>{$t.dashboard.logged}</span>
      </div>
    {:else}
      <div class="form-row">
        <select bind:value={selectedSubjectId} class="field-select" aria-label={$t.dashboard.subjectField} style={selectedSubject ? `color: ${selectedSubject.color}` : ''}>
          <option value="">{$t.dashboard.subjectField}</option>
          {#each subjects as sub}
            <option value={sub.id}>{sub.name}</option>
          {/each}
        </select>
        <select bind:value={selectedTopicId} class="field-select" disabled={!selectedSubjectId} aria-label={$t.dashboard.topicField}>
          <option value="">{$t.dashboard.topicField}</option>
          {#each subjectTopics as tp}
            <option value={tp.id}>{tp.name}</option>
          {/each}
        </select>
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
  .field-select {
    flex: 1;
    padding: 9px 10px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    outline: none;
    min-width: 0;
  }
  .field-select:focus { border-color: var(--primary); }
  .field-select:disabled { opacity: 0.5; }
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
    gap: 8px;
    padding: 8px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--primary);
  }

  @media (max-width: 768px) {
    .field-select { min-height: 44px; }
    .duration-input { min-height: 44px; }
    .log-btn { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
  }
</style>
