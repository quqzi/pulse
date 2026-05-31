<script lang="ts">
  import type { StudySession } from '$lib/types';
  import { formatDuration, localDateStr } from '$lib/utils';
  import { HISTORY_WEEKS } from '$lib/constants';

  export let sessions: StudySession[] = [];

  const WEEKS = HISTORY_WEEKS;
  const INTENSITY_HOURS = [0, 0.5, 1.5, 3];

  function sessionsByDay(ss: StudySession[]): Map<string, StudySession[]> {
    const map = new Map<string, StudySession[]>();
    for (const s of ss) {
      const day = localDateStr(new Date(s.startedAt));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    return map;
  }

  function intensityLevel(hours: number): number {
    if (hours <= 0) return 0;
    for (let i = INTENSITY_HOURS.length - 1; i >= 0; i--) {
      if (hours >= INTENSITY_HOURS[i]) return i + 1;
    }
    return 1;
  }

  type Cell = { dateStr: string; level: number; tooltip: string; inRange: boolean };

  $: byDay = sessionsByDay(sessions);

  $: gridData = (() => {
    const today = new Date();
    const endSunday = new Date(today);
    const dayOfWeek = today.getDay();
    endSunday.setDate(today.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek));
    endSunday.setHours(0, 0, 0, 0);

    const startDate = new Date(endSunday);
    startDate.setDate(endSunday.getDate() - WEEKS * 7 + 1);

    const todayStr = localDateStr(today);
    const cols: Cell[][] = [];

    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const cell = new Date(startDate);
        cell.setDate(startDate.getDate() + w * 7 + d);
        const dateStr = localDateStr(cell);
        const isFuture = dateStr > todayStr;
        const daySessions = byDay.get(dateStr) ?? [];
        const totalSec = daySessions.reduce((s, x) => s + x.durationSec, 0);
        const hours = totalSec / 3600;
        const level = isFuture ? 0 : intensityLevel(hours);
        const dayLabel = cell.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const tooltip = isFuture
          ? ''
          : daySessions.length === 0
          ? `${dayLabel} · No study`
          : `${dayLabel} · ${formatDuration(totalSec)} · ${daySessions.length} session${daySessions.length === 1 ? '' : 's'}`;
        col.push({ dateStr, level, tooltip, inRange: !isFuture });
      }
      cols.push(col);
    }
    return cols;
  })();

  $: monthLabels = (() => {
    return gridData.map((col) => {
      const mondayStr = col[0].dateStr;
      const mondayDate = new Date(mondayStr + 'T00:00:00');
      if (mondayDate.getDate() <= 7) {
        return mondayDate.toLocaleDateString('en-US', { month: 'short' });
      }
      return '';
    });
  })();
</script>

<div class="heatmap-wrap">
  <div class="heatmap-grid" style="--weeks: {WEEKS};">
    {#each monthLabels as label}
      <div class="month-label">{label}</div>
    {/each}
    {#each gridData as col, wi}
      {#each col as cell, di}
        <div
          class="day-cell level-{cell.level}"
          class:future={!cell.inRange}
          title={cell.tooltip}
          aria-label={cell.tooltip || cell.dateStr}
          style="grid-column: {wi + 1}; grid-row: {di + 2};"
        ></div>
      {/each}
    {/each}
  </div>

  <div class="legend">
    <span class="legend-label">Less</span>
    {#each [0, 1, 2, 3, 4] as lvl}
      <div class="legend-cell level-{lvl}"></div>
    {/each}
    <span class="legend-label">More</span>
  </div>
</div>

<style>
  .heatmap-wrap { display: flex; flex-direction: column; gap: 8px; overflow-x: auto; padding-bottom: 4px; }

  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(var(--weeks), 14px);
    grid-template-rows: 16px repeat(7, 14px);
    gap: 3px;
    width: max-content;
  }

  .month-label { font-size: 10px; color: var(--muted); line-height: 16px; overflow: hidden; white-space: nowrap; grid-row: 1; }

  .day-cell { width: 14px; height: 14px; border-radius: 3px; cursor: default; }
  .day-cell.level-0 { background: transparent; border: 1px solid var(--border); }
  .day-cell.future { background: transparent; border: 1px solid transparent; cursor: default; }
  .day-cell.level-1 { background: rgba(var(--primary-rgb), 0.20); border: none; }
  .day-cell.level-2 { background: rgba(var(--primary-rgb), 0.40); border: none; }
  .day-cell.level-3 { background: rgba(var(--primary-rgb), 0.70); border: none; }
  .day-cell.level-4 { background: rgba(var(--primary-rgb), 1.00); border: none; }

  .legend { display: flex; align-items: center; gap: 3px; justify-content: flex-end; }
  .legend-label { font-size: 10px; color: var(--muted); margin: 0 3px; }
  .legend-cell { width: 12px; height: 12px; border-radius: 2px; }
  .legend-cell.level-0 { background: transparent; border: 1px solid var(--border); }
  .legend-cell.level-1 { background: rgba(var(--primary-rgb), 0.20); }
  .legend-cell.level-2 { background: rgba(var(--primary-rgb), 0.40); }
  .legend-cell.level-3 { background: rgba(var(--primary-rgb), 0.70); }
  .legend-cell.level-4 { background: rgba(var(--primary-rgb), 1.00); }
</style>
