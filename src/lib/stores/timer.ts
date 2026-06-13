import { writable, derived } from 'svelte/store';
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

export function resetTimer(): void {
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
  if (browser) {
    _interval = setInterval(() => {
      timerStore.update(t => {
        if (t.status !== 'running') return t;
        const newElapsed = _baseElapsed + Math.floor((Date.now() - _anchorMs) / 1000);
        if (t.mode === 'pomodoro' && newElapsed >= t.total) {
          clearInterval(_interval!);
          _interval = null;
          _onComplete?.();
          return { ...t, elapsed: t.total, status: 'idle' };
        }
        return { ...t, elapsed: newElapsed };
      });
    }, 500);
  }
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
}

export function stopTimer(): void {
  if (_interval) { clearInterval(_interval); _interval = null; }
  timerStore.update(t => ({ ...t, status: 'idle' }));
}
