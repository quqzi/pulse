import type { ScheduleSlot } from './types';

/** Number of AI-suggested slots awaiting accept/reject. Source for the mobile "N AI" pill. */
export function pendingAiCount(slots: ScheduleSlot[]): number {
  return slots.filter((s) => s.isAiSuggested).length;
}
