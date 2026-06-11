// Pure time-grid math for the week calendar (1px = 1 minute, 15-min snap).
// Extracted from WeekGrid.svelte so it can be unit-tested in isolation.

export const GRID_SNAP_MIN = 15;
export const DAY_MINUTES = 24 * 60;

/** Round minutes to the snap grid. */
export function snap(min: number, step = GRID_SNAP_MIN): number {
  return Math.round(min / step) * step;
}

/**
 * Local-naive ISO string for `day` at `totalMinutes` past midnight,
 * clamped to [0, 24h]. 24:00 rolls to the next day's 00:00 by design.
 * Never uses toISOString — the machine may not be UTC.
 */
export function toLocalISO(day: Date, totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES, totalMinutes));
  const d = new Date(day);
  d.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** Whole days between the week start and `date`, by local calendar date. */
export function dayIndexFrom(weekStart: Date, date: Date): number {
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const b = new Date(weekStart);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
