<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
  import { subjects, topics, loadData, getAuthContext } from '$lib/stores/data';
  import {
    timerStore, remaining, startTimer, pauseTimer, stopTimer, resetTimer,
    type TimerMode
  } from '$lib/stores/timer';
  import { newId } from '$lib/id';
  import { sessionsRepo } from '$lib/data/entities';
  import { t } from '$lib/i18n';

  let showSummary = false;
  let lastSession: { durationSec: number; subjectName: string; topicName: string | null } | null = null;

  $: selectedSubject = $subjects.find(s => s.id === $timerStore.subjectId) ?? null;
  $: subjectTopics = $timerStore.subjectId ? $topics.filter(tp => tp.subjectId === $timerStore.subjectId) : [];
  $: selectedTopic = $topics.find(tp => tp.id === $timerStore.topicId) ?? null;

  $: displayTime = formatTime($remaining);
  $: canStart = $timerStore.subjectId !== null;
  $: isRunning = $timerStore.status === 'running';
  $: isPaused = $timerStore.status === 'paused';

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function setMode(mode: TimerMode) {
    if ($timerStore.status !== 'idle') return;
    timerStore.update(tp => ({
      ...tp,
      mode,
      elapsed: 0,
      phase: 'work',
      total: mode === 'pomodoro' ? $settings.pomodoroWork * 60 : 0,
    }));
  }

  function handleStart() {
    startTimer(onPomodoroComplete);
  }

  async function onPomodoroComplete() {
    await logCurrentSession();
    showSummary = true;
  }

  async function handleStop() {
    const elapsed = $timerStore.elapsed;
    if (elapsed >= 60) await logCurrentSession();
    stopTimer();
    if (elapsed >= 60) showSummary = true;
  }

  async function logCurrentSession() {
    if (!$timerStore.subjectId || !$timerStore.startedAt) return;
    const elapsed = $timerStore.elapsed;
    if (elapsed < 1) return;
    const { userId } = getAuthContext();
    const now = new Date();
    const session = {
      id: newId(),
      userId,
      subjectId: $timerStore.subjectId,
      topicId: $timerStore.topicId ?? undefined,
      startedAt: $timerStore.startedAt,
      endedAt: now.toISOString(),
      durationSec: elapsed,
      mode: $timerStore.mode as 'pomodoro' | 'free',
    };
    await sessionsRepo.log(session);
    lastSession = {
      durationSec: elapsed,
      subjectName: selectedSubject?.name ?? '',
      topicName: selectedTopic?.name ?? null,
    };
  }

  function dismissSummary() {
    showSummary = false;
    resetTimer();
    lastSession = null;
  }

  onMount(() => loadData($auth));
</script>

{#if showSummary && lastSession}
  <div class="overlay" role="dialog" aria-modal="true" tabindex="-1"
    on:click|self={dismissSummary}
    on:keydown={(e) => e.key === 'Escape' && dismissSummary()}>
    <div class="summary-card card">
      <div class="summary-check">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>
      <h2 class="text-heading" style="margin-bottom:4px">{$t.timer.sessionLogged}</h2>
      <p class="text-body" style="color: var(--muted); margin-bottom:16px;">
        {formatTime(lastSession.durationSec)} · {lastSession.subjectName}
        {#if lastSession.topicName} · {lastSession.topicName}{/if}
      </p>
      <button class="btn-primary done-btn" on:click={dismissSummary}>{$t.timer.done}</button>
    </div>
  </div>
{/if}

<div class="page" class:focus={$timerStore.focusMode}>
  <h1 class="text-large-title page-title">{$t.nav.timer}</h1>

  <div class="mode-tabs">
    <button class="mode-tab" class:active={$timerStore.mode === 'pomodoro'} on:click={() => setMode('pomodoro')} disabled={isRunning || isPaused}>{$t.timer.pomodoro}</button>
    <button class="mode-tab" class:active={$timerStore.mode === 'free'} on:click={() => setMode('free')} disabled={isRunning || isPaused}>{$t.timer.free}</button>
  </div>

  <div class="timer-display" class:running={isRunning}>
    <div class="time-text">{displayTime}</div>
    {#if $timerStore.mode === 'pomodoro'}
      <div class="phase-label">{$timerStore.phase === 'work' ? $t.timer.focus : $t.timer.breakLabel} · {$t.timer.round} {$timerStore.pomodoroRound}</div>
    {:else}
      <div class="phase-label">{isRunning ? $t.timer.studying : $t.timer.ready}</div>
    {/if}
  </div>

  <div class="selector-row">
    <select
      bind:value={$timerStore.subjectId}
      on:change={() => timerStore.update(tp => ({ ...tp, topicId: null }))}
      class="field-select"
      disabled={isRunning || isPaused}
      aria-label={$t.timer.selectSubject}
      style={selectedSubject ? `color: ${selectedSubject.color}; border-color: ${selectedSubject.color};` : ''}
    >
      <option value={null}>{$t.timer.selectSubject}</option>
      {#each $subjects as sub}
        <option value={sub.id}>{sub.name}</option>
      {/each}
    </select>
    {#if subjectTopics.length > 0}
      <select bind:value={$timerStore.topicId} class="field-select" disabled={isRunning || isPaused} aria-label={$t.timer.selectTopic}>
        <option value={null}>{$t.timer.selectTopic}</option>
        {#each subjectTopics as tp}
          <option value={tp.id}>{tp.name}</option>
        {/each}
      </select>
    {/if}
  </div>

  <div class="controls">
    {#if !isRunning && !isPaused}
      <button class="btn-start btn-primary" disabled={!canStart} on:click={handleStart}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        {$t.timer.start}
      </button>
    {:else}
      <button class="btn-ctrl" on:click={() => isRunning ? pauseTimer() : startTimer(onPomodoroComplete)}>
        {#if isRunning}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {$t.timer.pause}
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          {$t.timer.resume}
        {/if}
      </button>
      <button class="btn-stop" on:click={handleStop}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        {$t.timer.stop}
      </button>
    {/if}
  </div>

  {#if !isRunning && !isPaused}
    <button
      class="focus-toggle"
      on:click={() => timerStore.update(tp => ({ ...tp, focusMode: !tp.focusMode }))}
    >
      {$timerStore.focusMode ? $t.timer.exitFocus : $t.timer.focusMode}
    </button>
  {/if}
</div>

<style>
  .page {
    padding: 24px 16px;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-height: 100%;
  }
  .page.focus {
    position: fixed;
    inset: 0;
    background: var(--bg);
    z-index: 100;
    max-width: 100%;
    justify-content: center;
  }
  .page-title { align-self: flex-start; }
  .page.focus .page-title, .page.focus .mode-tabs, .page.focus .selector-row { display: none; }
  .mode-tabs {
    display: flex;
    gap: 4px;
    background: var(--bg3);
    border-radius: 10px;
    padding: 3px;
    align-self: stretch;
  }
  .mode-tab {
    flex: 1;
    padding: 7px 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms, color 150ms;
  }
  .mode-tab.active {
    background: var(--bg2);
    color: var(--text);
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
  }
  .mode-tab:disabled { cursor: not-allowed; }
  .timer-display { text-align: center; padding: 16px 0; }
  .time-text {
    font-size: 72px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    transition: color 300ms;
  }
  .timer-display.running .time-text { color: var(--primary); }
  .phase-label { font-size: 13px; font-weight: 500; color: var(--muted); margin-top: 8px; }
  .selector-row { display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
  .field-select {
    padding: 10px 12px;
    border: 1.5px solid var(--border);
    border-radius: 12px;
    background: var(--bg2);
    color: var(--text);
    font-size: 15px;
    outline: none;
    width: 100%;
    transition: border-color 150ms;
  }
  .field-select:focus { border-color: var(--primary); }
  .controls { display: flex; gap: 12px; }
  .btn-start {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 48px;
    border-radius: 14px;
    background: var(--primary);
    color: var(--bg);
    font-size: 17px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .btn-start:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .btn-start:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-ctrl, .btn-stop {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 28px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .btn-ctrl { background: var(--primary); color: var(--bg); }
  .btn-stop { background: var(--bg3); color: var(--text); }
  .btn-ctrl:active, .btn-stop:active { transform: scale(0.94); transition: transform 80ms ease-in; }
  .focus-toggle {
    font-size: 13px;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .focus-toggle:hover { color: var(--primary); }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 24px;
  }
  .summary-card {
    padding: 28px 24px;
    text-align: center;
    max-width: 320px;
    width: 100%;
    animation: scaleIn 200ms ease-out;
  }
  @keyframes scaleIn {
    from { transform: scale(0.96); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  .summary-check {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }
  .done-btn {
    padding: 11px 36px;
    border-radius: 12px;
    background: var(--primary);
    color: var(--bg);
    font-size: 15px;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .mode-tab { min-height: 44px; display: flex; align-items: center; justify-content: center; }
    .focus-toggle { min-height: 44px; display: inline-flex; align-items: center; padding: 10px 8px; }
  }
</style>
