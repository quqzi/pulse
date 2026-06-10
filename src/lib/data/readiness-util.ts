import type { Topic } from '$lib/types';

/** Fraction of a subject's topics marked covered (0 when the subject has no topics). */
export function subjectCoverage(topics: Pick<Topic, 'done'>[]): number {
  if (topics.length === 0) return 0;
  return topics.filter(t => t.done).length / topics.length;
}
