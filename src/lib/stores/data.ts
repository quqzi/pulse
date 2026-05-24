import { writable, derived } from 'svelte/store';
import { db } from '$lib/db';
import type { Subject, Topic, SrsCard, StudySession } from '$lib/types';
import type { AuthState } from '$lib/stores/auth';

export const subjects = writable<Subject[]>([]);
export const topics = writable<Topic[]>([]);
export const srsCards = writable<SrsCard[]>([]);
export const sessions = writable<StudySession[]>([]);

export const todaysSessions = derived(sessions, ($s) => {
  const today = new Date().toISOString().split('T')[0];
  return $s.filter(s => s.startedAt.startsWith(today));
});

export const dueCards = derived(srsCards, ($cards) => {
  const today = new Date().toISOString().split('T')[0];
  return $cards.filter(c => c.dueDate <= today);
});

export const todayHours = derived(todaysSessions, ($s) =>
  $s.reduce((sum, s) => sum + s.durationSec / 3600, 0)
);

export const streak = derived(sessions, ($s) => {
  if ($s.length === 0) return 0;
  const days = new Set($s.map(s => s.startedAt.split('T')[0]));
  let count = 0;
  const d = new Date();
  let base = d.toISOString().split('T')[0];
  if (!days.has(base)) {
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
    if (!days.has(base)) return 0;
  }
  while (days.has(base)) {
    count++;
    d.setDate(d.getDate() - 1);
    base = d.toISOString().split('T')[0];
  }
  return count;
});

let _mode: 'guest' | 'authenticated' = 'guest';
let _userId = 'guest';

export async function loadData(authState: AuthState): Promise<void> {
  if (authState.mode === 'loading') return;
  _mode = authState.mode;
  _userId = authState.mode === 'guest' ? 'guest' : (authState.user?.id ?? '');

  const [s, t, c, sess] = await Promise.all([
    db.getSubjects(_userId, _mode),
    db.getTopics(_userId, _mode),
    db.getSrsCards(_userId, _mode),
    db.getSessions(_userId, _mode),
  ]);
  subjects.set(s);
  topics.set(t);
  srsCards.set(c);
  sessions.set(sess);
}

export function getAuthContext(): { userId: string; mode: 'guest' | 'authenticated' } {
  return { userId: _userId, mode: _mode };
}
