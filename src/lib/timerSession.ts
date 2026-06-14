import { get } from 'svelte/store';
import { timerStore } from '$lib/stores/timer';
import { sessionsRepo } from '$lib/data/entities';
import { getAuthContext } from '$lib/data/authctx';
import { newId } from '$lib/id';

/**
 * Log the current (finished / stopped) timer session from the store.
 * Shared by the timer page, the global timer pill, and the resume-on-open path so
 * a session is never lost no matter where the user ends it.
 * Returns the logged duration, or null if there's nothing worth logging.
 */
export async function logCurrentTimerSession(): Promise<number | null> {
  const s = get(timerStore);
  if (!s.subjectId || !s.startedAt || s.elapsed < 1) return null;
  const { userId } = getAuthContext();
  await sessionsRepo.log({
    id: newId(),
    userId,
    subjectId: s.subjectId,
    topicId: s.topicId ?? undefined,
    startedAt: s.startedAt,
    endedAt: new Date().toISOString(),
    durationSec: s.elapsed,
    mode: s.mode,
  });
  return s.elapsed;
}
