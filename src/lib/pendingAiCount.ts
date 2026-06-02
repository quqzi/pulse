import type { ScheduleSlot } from './types';

/** Number of AI-suggested slots awaiting accept/reject (suggested and not yet confirmed).
 *  Matches the accept-all predicate; source for the mobile "N AI" pill. */
export function pendingAiCount(slots: ScheduleSlot[]): number {
  return slots.filter((s) => s.isAiSuggested && !s.isConfirmed).length;
}
