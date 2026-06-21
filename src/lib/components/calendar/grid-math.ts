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

/**
 * Column-packing layout for overlapping slots (Apple/Google Calendar style).
 *
 * Given an array of slots for a single day (each with startMinutes and endMinutes),
 * returns a map from slot id → { col, total } where:
 *   col   = 0-based column index within the cluster
 *   total = total number of columns in that cluster
 *
 * A "cluster" is a maximal set of slots that all overlap (transitively).
 * Single non-overlapping slots get col=0, total=1 (full width).
 */
export interface SlotInterval {
  id: string;
  startMin: number; // minutes from midnight
  endMin: number;
}

export interface ColumnLayout {
  col: number;
  total: number;
}

export function packSlots(slots: SlotInterval[]): Map<string, ColumnLayout> {
  const result = new Map<string, ColumnLayout>();
  if (slots.length === 0) return result;

  // Sort by start time, then by duration descending (longer slots get earlier columns).
  const sorted = [...slots].sort((a, b) =>
    a.startMin !== b.startMin ? a.startMin - b.startMin : (b.endMin - b.startMin) - (a.endMin - a.startMin)
  );

  // Build clusters: groups of slots where at least one pair overlaps.
  const clusters: SlotInterval[][] = [];
  let currentCluster: SlotInterval[] = [];
  let clusterEnd = -Infinity;

  for (const slot of sorted) {
    if (slot.startMin < clusterEnd) {
      // Overlaps with the current cluster.
      currentCluster.push(slot);
      clusterEnd = Math.max(clusterEnd, slot.endMin);
    } else {
      // New cluster.
      if (currentCluster.length > 0) clusters.push(currentCluster);
      currentCluster = [slot];
      clusterEnd = slot.endMin;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // For each cluster, assign columns using a greedy interval-graph coloring.
  for (const cluster of clusters) {
    // columns[i] = end minute of the last slot assigned to column i
    const colEnds: number[] = [];

    const assignments = new Map<string, number>();

    for (const slot of cluster) {
      // Find the first column where this slot fits (doesn't overlap with the last slot there).
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (slot.startMin >= colEnds[c]) {
          colEnds[c] = slot.endMin;
          assignments.set(slot.id, c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        assignments.set(slot.id, colEnds.length);
        colEnds.push(slot.endMin);
      }
    }

    const total = colEnds.length;
    for (const [id, col] of assignments) {
      result.set(id, { col, total });
    }
  }

  return result;
}
