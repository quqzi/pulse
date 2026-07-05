import type { Topic } from '$lib/types';

/** Fraction of a subject's topics marked covered (0 when the subject has no topics). */
export function subjectCoverage(topics: Pick<Topic, 'done'>[]): number {
  if (topics.length === 0) return 0;
  return topics.filter(t => t.done).length / topics.length;
}

export interface ExamAttempt {
  ratio: number; // 0–1 accuracy of one attempt
  date: string;  // sortable date string (YYYY-MM-DD or ISO timestamp)
}

const RECENT_ATTEMPTS = 5;

/**
 * Recency-weighted exam accuracy (0–1): only the last RECENT_ATTEMPTS attempts
 * count, weighted newest→oldest so recent improvement shows instead of being
 * diluted by an all-time mean.
 */
export function examAccuracy(attempts: ExamAttempt[]): number {
  if (attempts.length === 0) return 0;
  const recent = [...attempts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_ATTEMPTS);
  let weighted = 0;
  let totalWeight = 0;
  recent.forEach((a, i) => {
    const w = RECENT_ATTEMPTS - i;
    weighted += a.ratio * w;
    totalWeight += w;
  });
  return weighted / totalWeight;
}
