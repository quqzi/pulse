<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { timerStore, remaining, pauseTimer, startTimer, stopTimer } from '$lib/stores/timer';
  import { subjects } from '$lib/stores/data';
  import { logCurrentTimerSession } from '$lib/timerSession';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';

  // Show a running/paused timer everywhere except the timer page itself, so a
  // session backgrounded on mobile is visibly alive (and controllable) wherever
  // the app reopens — not silently "gone".
  $: show = $timerStore.status !== 'idle' && $page.url.pathname !== '/timer';
  $: subject = $subjects.find((s) => s.id === $timerStore.subjectId) ?? null;
  $: running = $timerStore.status === 'running';

  function fmt(secs: number): string {
    const s = Math.max(0, Math.floor(secs));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
  }

  function onComplete() {
    void logCurrentTimerSession().then((dur) => {
      if (dur !== null) toast.success($t.timer.sessionSaved);
    });
  }

  function onToggle(e: MouseEvent) {
    e.stopPropagation();
    if (running) pauseTimer();
    else startTimer(onComplete);
  }

  async function onStop(e: MouseEvent) {
    e.stopPropagation();
    if ($timerStore.elapsed >= 60) {
      const dur = await logCurrentTimerSession();
      if (dur !== null) toast.success($t.timer.sessionSaved);
    }
    stopTimer();
  }
</script>

{#if show}
  <div class="timer-pill glass-panel">
    <button class="pill-main" on:click={() => goto('/timer')} aria-label={$t.timer.openTimer}>
      <span class="dot" class:running style="--c: {subject?.color ?? 'var(--primary)'}"></span>
      <span class="info">
        <span class="time">{fmt($remaining)}</span>
        {#if subject}<span class="subj">{subject.name}</span>{/if}
      </span>
    </button>
    <div class="actions">
      <button class="pbtn" on:click={onToggle} aria-label={running ? $t.timer.pause : $t.timer.resume}>
        {#if running}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        {/if}
      </button>
      <button class="pbtn" on:click={onStop} aria-label={$t.timer.stop}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .timer-pill {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 12px);
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 6px 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    max-width: calc(100vw - 32px);
  }
  .pill-main {
    display: flex;
    align-items: center;
    gap: 9px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 4px 4px 0;
    min-width: 0;
    font-family: inherit;
  }
  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c);
    flex-shrink: 0;
  }
  .dot.running {
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  .info { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .time {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .subj {
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 30vw;
  }
  .actions { display: flex; align-items: center; gap: 2px; }
  .pbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: var(--bg3);
    color: var(--text);
    cursor: pointer;
    flex-shrink: 0;
    transition: transform var(--dur-base) var(--ease-spring), background 150ms;
  }
  .pbtn:active { transform: scale(0.9); transition: transform 80ms ease-in; }

  @media (min-width: 768px) {
    .timer-pill {
      left: auto;
      right: 24px;
      transform: none;
      bottom: 24px;
    }
  }
</style>
