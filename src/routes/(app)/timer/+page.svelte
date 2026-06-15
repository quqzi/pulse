<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
  import { subjects, topics, tasks, loadData, getAuthContext } from '$lib/stores/data';
  import { completeTask } from '$lib/tasks';
  import {
    timerStore, remaining, startTimer, pauseTimer, stopTimer, resetTimer, resumeTimer,
    type TimerMode
  } from '$lib/stores/timer';
  import { newId } from '$lib/id';
  import { sessionsRepo } from '$lib/data/entities';
  import { schedulePomodoroPush, cancelPomodoroPush } from '$lib/pomodoroPush';
  import { t } from '$lib/i18n';
  import Picker from '$lib/components/Picker.svelte';
  import MusicPlayer from '$lib/components/MusicPlayer.svelte';

  let showSummary = false;
  let lastSession: { durationSec: number; subjectName: string; topicName: string | null } | null = null;

  $: selectedSubject = $subjects.find(s => s.id === $timerStore.subjectId) ?? null;
  $: subjectTopics = $timerStore.subjectId ? $topics.filter(tp => tp.subjectId === $timerStore.subjectId) : [];
  $: selectedTopic = $topics.find(tp => tp.id === $timerStore.topicId) ?? null;
  $: linkedTask = $timerStore.taskId
    ? ($tasks.find(tp => tp.id === $timerStore.taskId && !tp.completedAt) ?? null)
    : null;

  $: displayTime = formatTime($remaining);

  // Progress ring: pomodoro counts down the session; free mode laps once an hour.
  const RING_R = 110;
  const RING_C = 2 * Math.PI * RING_R;
  $: ringFrac = $timerStore.mode === 'pomodoro'
    ? ($timerStore.total > 0 ? Math.max(0, Math.min(1, $remaining / $timerStore.total)) : 0)
    : ($timerStore.elapsed % 3600) / 3600;
  $: canStart = $timerStore.subjectId !== null;
  $: isRunning = $timerStore.status === 'running';
  $: isPaused = $timerStore.status === 'paused';

  function formatTime(secs: number): string {
    const total = Math.max(0, Math.floor(secs));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Show the hour segment only once the clock reaches 60 min — keeps the
    // common sub-hour case as MM:SS for both pomodoro and free timers.
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
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
    void schedulePomodoroPush(); // closed-app "pomodoro done" alert (pomodoro only)
  }

  // Resume from pause — re-arm the push, since the finish time has shifted.
  function handleResume() {
    startTimer(onPomodoroComplete);
    void schedulePomodoroPush();
  }

  function handlePause() {
    pauseTimer();
    void cancelPomodoroPush(); // paused = no fixed finish time, so drop the alert
  }

  async function onPomodoroComplete() {
    void cancelPomodoroPush(); // it fired (or is about to) — don't leave a stale row
    await logCurrentSession();
    showSummary = true;
  }

  async function handleStop() {
    const elapsed = $timerStore.elapsed;
    if (elapsed >= 60) await logCurrentSession();
    stopTimer();
    void cancelPomodoroPush();
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

  onMount(() => {
    loadData($auth);
    // Restore a timer that was running before a reload / tab close / deploy.
    // If a pomodoro finished while away, resumeTimer fires onPomodoroComplete,
    // which logs the session and opens the summary.
    resumeTimer(onPomodoroComplete);
  });
  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

{#if showSummary && lastSession}
  <div class="overlay" role="dialog" aria-modal="true" tabindex="-1"
    on:click|self={dismissSummary}
    on:keydown={(e) => e.key === 'Escape' && dismissSummary()}>
    <div class="summary-card glass-panel">
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
      {#if linkedTask}
        <button class="task-done-btn" on:click={() => linkedTask && completeTask(linkedTask)}>
          ✓ {$t.timer.markTaskDone} · {linkedTask.title}
        </button>
      {/if}
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

  {#if $timerStore.mode === 'free'}
    <p class="mode-note">{$t.timer.freeBgNote}</p>
  {:else}
    <p class="mode-note">{$t.timer.pomodoroBgNote}</p>
  {/if}

  <div class="timer-display" class:running={isRunning} class:engaged={isRunning || isPaused}>
    <svg class="ring" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="ring-track" cx="120" cy="120" r={RING_R} />
      <circle
        class="ring-arc"
        cx="120" cy="120" r={RING_R}
        style="stroke-dasharray:{RING_C}; stroke-dashoffset:{RING_C * (1 - ringFrac)};"
      />
    </svg>
    <div class="ring-center">
      <div class="time-text">{displayTime}</div>
      {#if $timerStore.mode === 'pomodoro'}
        <div class="phase-label">{$timerStore.phase === 'work' ? $t.timer.focus : $t.timer.breakLabel} · {$t.timer.round} {$timerStore.pomodoroRound}</div>
      {:else}
        <div class="phase-label">{isRunning ? $t.timer.studying : $t.timer.ready}</div>
      {/if}
    </div>
  </div>

  <div class="selector-row">
    <Picker
      value={$timerStore.subjectId ?? ''}
      options={$subjects.map(s => ({ value: s.id, label: s.name, color: s.color }))}
      placeholder={$t.timer.selectSubject}
      disabled={isRunning || isPaused}
      on:change={(e) => timerStore.update(tp => ({ ...tp, subjectId: e.detail.value || null, topicId: null }))}
    />
    {#if subjectTopics.length > 0}
      <Picker
        value={$timerStore.topicId ?? ''}
        options={subjectTopics.map(tp => ({ value: tp.id, label: tp.name }))}
        placeholder={$t.timer.selectTopic}
        disabled={isRunning || isPaused}
        on:change={(e) => timerStore.update(tp => ({ ...tp, topicId: e.detail.value || null }))}
      />
    {/if}
  </div>

  <div class="controls">
    {#if !isRunning && !isPaused}
      <button class="btn-start btn-primary" disabled={!canStart} on:click={handleStart}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        {$t.timer.start}
      </button>
    {:else}
      <button class="btn-ctrl" on:click={() => isRunning ? handlePause() : handleResume()}>
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

  <MusicPlayer />
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
  .page.focus .page-title, .page.focus .mode-tabs, .page.focus .selector-row, .page.focus .mode-note { display: none; }
  .mode-note {
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
    text-align: center;
    max-width: 340px;
    margin: -2px auto 0;
  }
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
  .timer-display {
    position: relative;
    width: min(300px, 76vw);
    aspect-ratio: 1;
    margin: 4px 0;
  }
  .ring { width: 100%; height: 100%; transform: rotate(-90deg); }
  /* Invisible at rest — the ring fades in only while a session is live. */
  .ring-track {
    fill: none; stroke: color-mix(in srgb, var(--text) 12%, transparent); stroke-width: 4;
    opacity: 0; transition: opacity 500ms ease;
  }
  /* Frosted-white ring on every theme: clean glow on dark, and on light the
     translucent white + soft shadow reads as glass over the aurora instead of
     an ink circle. (Deliberate white — it's the requested material, with a
     shadow supplying the contrast the bg can't.) */
  .ring-arc {
    fill: none; stroke: rgba(255, 255, 255, 0.92); /* stylelint-disable-line */
    stroke-width: 5; stroke-linecap: round;
    opacity: 0;
    transition: stroke-dashoffset 1s linear, opacity 500ms ease, filter 300ms ease;
  }
  .timer-display.engaged .ring-track { opacity: 1; }
  .timer-display.engaged .ring-arc {
    opacity: 0.95;
    filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.25));
  }
  .timer-display.running .ring-arc {
    opacity: 1;
    filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.22)) drop-shadow(0 0 8px rgba(255, 255, 255, 0.55)); /* stylelint-disable-line */
  }
  .ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
  }
  .time-text {
    font-size: clamp(44px, 16vw, 60px);
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
  .task-done-btn {
    display: block; width: 100%; margin-bottom: 10px;
    padding: 9px 14px; border-radius: 10px;
    border: 1.5px solid color-mix(in srgb, var(--primary) 35%, transparent);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    color: var(--primary); font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .task-done-btn:hover { background: color-mix(in srgb, var(--primary) 15%, transparent); }
  .summary-card {
    padding: 28px 24px;
    text-align: center;
    max-width: 320px;
    width: 100%;
    animation: scaleIn 200ms ease-out;
    border-radius: 18px;
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
