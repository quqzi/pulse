<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import Picker from '$lib/components/Picker.svelte';
  import type { Subject, Topic } from '$lib/types';

  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];

  const dispatch = createEventDispatcher<{
    log: { subjectId: string; topicId: string | undefined; durationMin: number; startedAt: string; endedAt: string }
  }>();

  type Period = 'justNow' | 'morning' | 'afternoon' | 'custom';
  const PERIODS: Period[] = ['justNow', 'morning', 'afternoon', 'custom'];
  const MORNING_START_HOUR = 9;
  const AFTERNOON_START_HOUR = 13;

  let selectedSubjectId = '';
  let selectedTopicId = '';
  let durationMin = 30;
  let period: Period = 'justNow';
  let customStart = '';
  let customEnd = '';
  let submitting = false;
  let done = false;
  let loggedMin = 0;
  let loggedSubjectName = '';
  const DONE_FLASH_MS = 2500;

  $: subjectTopics = topics.filter(tp => tp.subjectId === selectedSubjectId);
  $: selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  function hhmm(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function todayAt(time: string): Date | null {
    const m = /^(\d{2}):(\d{2})$/.exec(time);
    if (!m) return null;
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }

  function selectPeriod(p: Period) {
    period = p;
    if (p === 'custom' && !customStart) {
      const now = new Date();
      customEnd = hhmm(now);
      customStart = hhmm(new Date(now.getTime() - durationMin * 60000));
    }
  }

  // In custom mode the duration derives from the two times instead of the pills.
  $: customMin = (() => {
    const s = todayAt(customStart);
    const e = todayAt(customEnd);
    if (!s || !e) return 0;
    return Math.round((e.getTime() - s.getTime()) / 60000);
  })();

  $: effectiveMin = period === 'custom' ? customMin : durationMin;
  $: canSubmit = !!selectedSubjectId && effectiveMin >= 1 && !submitting;

  function computeWindow(): { start: Date; end: Date } {
    const now = new Date();
    if (period === 'custom') {
      return { start: todayAt(customStart)!, end: todayAt(customEnd)! };
    }
    if (period === 'morning' || period === 'afternoon') {
      const start = new Date();
      start.setHours(period === 'morning' ? MORNING_START_HOUR : AFTERNOON_START_HOUR, 0, 0, 0);
      return { start, end: new Date(start.getTime() + durationMin * 60000) };
    }
    return { start: new Date(now.getTime() - durationMin * 60000), end: now };
  }

  async function submit() {
    if (!canSubmit) return;
    submitting = true;
    const { start, end } = computeWindow();
    dispatch('log', {
      subjectId: selectedSubjectId,
      topicId: selectedTopicId || undefined,
      durationMin: effectiveMin,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
    });
    loggedMin = effectiveMin;
    loggedSubjectName = selectedSubject?.name ?? '';
    done = true;
    submitting = false;
    setTimeout(() => {
      done = false;
      selectedSubjectId = '';
      selectedTopicId = '';
      durationMin = 30;
      period = 'justNow';
      customStart = '';
      customEnd = '';
    }, DONE_FLASH_MS);
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
        <span>{loggedSubjectName ? $t.dashboard.loggedDetail(loggedMin, loggedSubjectName) : $t.dashboard.logged}</span>
      </div>
    {:else}
      <div class="subject-chips" role="group" aria-label={$t.dashboard.subjectField}>
        {#each subjects as s}
          <button
            class="subject-chip"
            class:active={selectedSubjectId === s.id}
            style="--chip-color: {s.color};"
            aria-pressed={selectedSubjectId === s.id}
            on:click={() => { selectedSubjectId = selectedSubjectId === s.id ? '' : s.id; selectedTopicId = ''; }}
          >
            <span class="chip-dot" style="background: {s.color};"></span>
            {s.name}
          </button>
        {/each}
      </div>
      {#if selectedSubjectId && subjectTopics.length > 0}
        <div class="form-row">
          <Picker
            bind:value={selectedTopicId}
            options={subjectTopics.map(tp => ({ value: tp.id, label: tp.name }))}
            placeholder={$t.dashboard.topicField}
          />
        </div>
      {/if}
      <div class="period-chips" role="group" aria-label={$t.dashboard.periodField}>
        {#each PERIODS as p}
          <button
            class="period-chip"
            class:active={period === p}
            aria-pressed={period === p}
            on:click={() => selectPeriod(p)}
          >{$t.dashboard.periods[p]}</button>
        {/each}
      </div>
      {#if period === 'custom'}
        <div class="form-row">
          <div class="time-field">
            <label class="time-label" for="ql-start">{$t.dashboard.startTime}</label>
            <input id="ql-start" type="time" bind:value={customStart} class="field-input time-input" />
          </div>
          <div class="time-field">
            <label class="time-label" for="ql-end">{$t.dashboard.endTime}</label>
            <input id="ql-end" type="time" bind:value={customEnd} class="field-input time-input" />
          </div>
          <div class="custom-dur" class:invalid={customMin < 1}>
            {customMin >= 1 ? `${customMin} ${$t.common.minutes}` : '—'}
          </div>
        </div>
      {:else}
        <div class="form-row">
          <div class="dur-pills" role="group" aria-label={$t.common.minutes}>
            {#each [15, 30, 45, 60] as m}
              <button
                class="dur-pill"
                class:active={durationMin === m}
                aria-pressed={durationMin === m}
                on:click={() => (durationMin = m)}
              >{m}</button>
            {/each}
          </div>
        </div>
      {/if}
      <div class="form-row">
        {#if period !== 'custom'}
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
        {:else}
          <div class="duration-row"></div>
        {/if}
        <button
          class="log-btn btn-primary"
          disabled={!canSubmit}
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
  /* Colored subject chips — same idiom as the schedule popover picker. */
  .subject-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .subject-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease-spring), background 160ms ease, color 160ms ease, border-color 160ms ease;
  }
  .subject-chip:active { transform: scale(0.94); transition-duration: var(--dur-fast); }
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
  .period-chips {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  .period-chip {
    flex: 1;
    padding: 7px 4px;
    border-radius: 10px;
    border: 1.5px solid var(--border);
    background: var(--bg3);
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: transform var(--dur-base) var(--ease-spring), background 160ms ease, color 160ms ease, border-color 160ms ease;
  }
  .period-chip:active { transform: scale(0.94); transition-duration: var(--dur-fast); }
  .period-chip.active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--bg);
  }
  .time-field { display: flex; align-items: center; gap: 6px; flex: 1; }
  .time-label { font-size: 12px; font-weight: 600; color: var(--muted); }
  .time-input {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--bg3);
    color: var(--text);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    outline: none;
  }
  .time-input:focus { border-color: var(--primary); }
  .custom-dur {
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    white-space: nowrap;
  }
  .custom-dur.invalid { color: var(--muted); opacity: 0.6; }
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
    .subject-chip { min-height: 44px; padding: 6px 14px; }
    .period-chip { min-height: 44px; }
    .time-input { min-height: 44px; }
    .period-chips { flex-wrap: wrap; }
    .period-chip { flex: 1 1 40%; }
  }
</style>
