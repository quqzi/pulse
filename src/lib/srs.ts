import { localDateStr } from '$lib/utils';

export interface ReviewResult {
  ease: number;
  intervalDays: number;
  dueDate: string;   // YYYY-MM-DD
}

/** SM-2 simplified. rating: 1=Again 2=Hard 3=Good 4=Easy */
export function reviewCard(ease: number, intervalDays: number, rating: 1 | 2 | 3 | 4): ReviewResult {
  let newEase = ease;
  let newInterval = intervalDays;

  switch (rating) {
    case 1:
      newInterval = 1;
      newEase = Math.max(1.3, ease - 0.2);
      break;
    case 2:
      newInterval = Math.max(1, Math.round(intervalDays * 1.2));
      newEase = Math.max(1.3, ease - 0.15);
      break;
    case 3:
      newInterval = Math.max(1, Math.round(intervalDays * ease));
      break;
    case 4:
      newInterval = Math.max(1, Math.round(intervalDays * ease * 1.3));
      newEase = ease + 0.1;
      break;
  }

  const due = new Date();
  due.setDate(due.getDate() + newInterval);
  const dueDate = localDateStr(due);

  return { ease: newEase, intervalDays: newInterval, dueDate };
}

export function defaultCard(): Pick<import('$lib/types').SrsCard, 'ease' | 'intervalDays' | 'dueDate' | 'reps'> {
  return { ease: 2.5, intervalDays: 1, dueDate: localDateStr(new Date()), reps: 0 };
}

export function isDue(dueDate: string): boolean {
  return dueDate <= localDateStr(new Date());
}
