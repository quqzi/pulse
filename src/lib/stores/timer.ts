import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

export type TimerMode = 'pomodoro' | 'free';
export type TimerStatus = 'idle' | 'running' | 'paused';
export type PomodoroPhase = 'work' | 'break';

export interface TimerState {
  mode: TimerMode;
  status: TimerStatus;
  phase: PomodoroPhase;
  elapsed: number;
  total: number;
  subjectId: string | null;
  topicId: string | null;
  taskId: string | null;   // set when the session was started from a task
  startedAt: string | null;
  pomodoroRound: number;
  focusMode: boolean;
}

function defaults(): TimerState {
  return {
    mode: 'pomodoro',
    status: 'idle',
    phase: 'work',
    elapsed: 0,
    total: 25 * 60,
    subjectId: null,
    topicId: null,
    taskId: null,
    startedAt: null,
    pomodoroRound: 1,
    focusMode: false,
  };
}

export const timerStore = writable<TimerState>(defaults());

export const remaining = derived(timerStore, ($t) =>
  $t.mode === 'pomodoro' ? Math.max(0, $t.total - $t.elapsed) : $t.elapsed
);

// ── Persistence ────────────────────────────────────────────────
// The running timer is mirrored to localStorage with a wall-clock stamp, so it
// survives a reload / tab close / deploy: on load we recompute elapsed from the
// real time that passed. (True OS-background execution needs a native app.)
const STORAGE_KEY = 'pulse.timer';
let _lastPersist = 0;

function persist(force = false): void {
  if (!browser) return;
  const state = get(timerStore);
  // Never auto-remove on idle — the store resets to idle on a reload before the
  // timer page resumes it, and a stray pagehide must not wipe a live snapshot.
  // Only stop/reset/complete clear it (via clearPersisted).
  if (state.status === 'idle') return;
  const now = Date.now();
  if (!force && now - _lastPersist < 2000) return; // throttle live ticks
  _lastPersist = now;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, persistedAt: now }));
}

function clearPersisted(): void {
  if (browser) localStorage.removeItem(STORAGE_KEY);
}

export function resetTimer(): void {
  clearPersisted();
  timerStore.set(defaults());
}

export function setTimerSubject(subjectId: string, topicId: string | null): void {
  timerStore.update(t => ({ ...t, subjectId, topicId }));
}

let _interval: ReturnType<typeof setInterval> | null = null;
let _onComplete: (() => void) | null = null;
// Wall-clock anchor — elapsed is derived from real time, not tick counting,
// so background-tab throttling and interval drift can't skew the timer.
let _anchorMs = 0;
let _baseElapsed = 0;

function startInterval(): void {
  if (!browser || _interval) return;
  _interval = setInterval(() => {
    timerStore.update(t => {
      if (t.status !== 'running') return t;
      const newElapsed = _baseElapsed + Math.floor((Date.now() - _anchorMs) / 1000);
      if (t.mode === 'pomodoro' && newElapsed >= t.total) {
        clearInterval(_interval!);
        _interval = null;
        clearPersisted();
        _onComplete?.();
        return { ...t, elapsed: t.total, status: 'idle' };
      }
      return { ...t, elapsed: newElapsed };
    });
    persist();
  }, 500);
}

export function startTimer(onComplete?: () => void): void {
  _onComplete = onComplete ?? null;
  timerStore.update(t => {
    _baseElapsed = t.elapsed;
    return {
      ...t,
      status: 'running',
      startedAt: t.startedAt ?? new Date().toISOString(),
    };
  });
  _anchorMs = Date.now();
  startInterval();
  persist(true);
}

export function pauseTimer(): void {
  if (_interval) { clearInterval(_interval); _interval = null; }
  // Snap elapsed to the exact wall-clock value at the moment of pausing.
  timerStore.update(t => {
    if (t.status !== 'running') return { ...t, status: 'paused' };
    const exact = _baseElapsed + Math.floor((Date.now() - _anchorMs) / 1000);
    const cap = t.mode === 'pomodoro' && t.total > 0 ? t.total : exact;
    return { ...t, status: 'paused', elapsed: Math.min(exact, cap) };
  });
  persist(true);
}

export function stopTimer(): void {
  if (_interval) { clearInterval(_interval); _interval = null; }
  clearPersisted();
  timerStore.update(t => ({ ...t, status: 'idle' }));
}

export interface ResumeResult {
  resumed: boolean;
  /** A pomodoro that would have finished while the app was closed/backgrounded. */
  completedWhileAway: boolean;
}

/**
 * Restore a timer that was running/paused before a reload, close or deploy.
 * Call once on the timer page's mount, passing the same completion callback as
 * startTimer. Recomputes elapsed from the real time that passed.
 */
export function resumeTimer(onComplete?: () => void): ResumeResult {
  if (!browser) return { resumed: false, completedWhileAway: false };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { resumed: false, completedWhileAway: false };

  let snap: { state: TimerState; persistedAt: number };
  try {
    snap = JSON.parse(raw);
  } catch {
    clearPersisted();
    return { resumed: false, completedWhileAway: false };
  }
  const { state, persistedAt } = snap;
  if (!state || typeof persistedAt !== 'number') { clearPersisted(); return { resumed: false, completedWhileAway: false }; }

  _onComplete = onComplete ?? null;

  if (state.status === 'paused') {
    timerStore.set(state); // paused time is fixed; restore verbatim
    return { resumed: true, completedWhileAway: false };
  }
  if (state.status !== 'running') {
    clearPersisted();
    return { resumed: false, completedWhileAway: false };
  }

  const awaySec = Math.max(0, Math.floor((Date.now() - persistedAt) / 1000));
  const elapsed = state.elapsed + awaySec;

  if (state.mode === 'pomodoro' && elapsed >= state.total) {
    // Finished while we were gone — finalize and let the page log + summarize.
    timerStore.set({ ...state, elapsed: state.total, status: 'idle' });
    clearPersisted();
    _onComplete?.();
    return { resumed: true, completedWhileAway: true };
  }

  timerStore.set({ ...state, elapsed, status: 'running' });
  _baseElapsed = elapsed;
  _anchorMs = Date.now();
  startInterval();
  persist(true);
  return { resumed: true, completedWhileAway: false };
}

// Snap the freshest elapsed to storage right before the tab is hidden/closed,
// so at most a sub-second is lost if the browser suspends us.
if (browser) {
  const snap = () => persist(true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) snap(); });
  window.addEventListener('pagehide', snap);
}
