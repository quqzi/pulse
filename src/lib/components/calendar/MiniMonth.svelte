<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { StudySession, Task, Subject } from '$lib/types';

  export let currentWeekStart: Date;
  export let sessions: StudySession[] = [];
  export let tasks: Task[] = [];
  export let subjects: Subject[] = [];

  const dispatch = createEventDispatcher<{ weekSelect: Date }>();

  let displayMonth = new Date(currentWeekStart);
  displayMonth.setDate(1);

  $: calendarDays = buildCalendar(displayMonth);
  $: upcomingTasks = getUpcomingTasks();

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  function buildCalendar(monthStart: Date) {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    // Offset: Monday-first. getDay() returns 0=Sun.
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function isToday(d: Date | null): boolean {
    if (!d) return false;
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }

  function isInCurrentWeek(d: Date | null): boolean {
    if (!d) return false;
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= currentWeekStart && d < weekEnd;
  }

  function getDotsForDay(d: Date | null): string[] {
    if (!d) return [];
    const dateStr = d.toISOString().split('T')[0];
    const daySessions = sessions.filter(s => s.startedAt.startsWith(dateStr));
    const subjectIds = [...new Set(daySessions.map(s => s.subjectId))].slice(0, 3);
    return subjectIds.map(id => subjects.find(s => s.id === id)?.color ?? 'var(--muted)');
  }

  function onDayClick(d: Date | null) {
    if (!d) return;
    // Navigate week grid to the week containing this date
    const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    dispatch('weekSelect', weekStart);
  }

  function prevMonth() {
    displayMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1);
  }

  function nextMonth() {
    displayMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1);
  }

  $: monthLabel = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function getUpcomingTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inTwoWeeks = new Date(today);
    inTwoWeeks.setDate(today.getDate() + 14);
    return tasks
      .filter(t => !t.completedAt && t.dueDate)
      .filter(t => {
        const due = new Date(t.dueDate!);
        return due >= today && due <= inTwoWeeks;
      })
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 5);
  }

  function taskDayLabel(task: Task): string {
    if (!task.dueDate) return '';
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
</script>

<div class="mini-month">
  <div class="month-nav">
    <button class="nav-btn" on:click={prevMonth}>‹</button>
    <span class="month-label">{monthLabel}</span>
    <button class="nav-btn" on:click={nextMonth}>›</button>
  </div>

  <div class="day-headers">
    {#each DAY_LABELS as label}
      <div class="day-header">{label}</div>
    {/each}
  </div>

  <div class="day-grid">
    {#each calendarDays as day}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div
        class="day-cell"
        class:today={isToday(day)}
        class:in-week={isInCurrentWeek(day) && !isToday(day)}
        class:empty={!day}
        on:click={() => onDayClick(day)}
      >
        {#if day}
          <span class="day-num">{day.getDate()}</span>
          <div class="day-dots">
            {#each getDotsForDay(day) as color}
              <span class="dot" style="background: {color};"></span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if upcomingTasks.length > 0}
    <div class="upcoming-section">
      <div class="upcoming-label">UPCOMING</div>
      {#each upcomingTasks as task}
        <div class="upcoming-task">
          <span class="task-title">{task.title}</span>
          <span class="task-due">{taskDayLabel(task)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mini-month {
    padding: 12px;
    font-size: 12px;
    color: var(--text);
  }
  .month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .month-label { font-size: 12px; font-weight: 600; }
  .nav-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 4px;
    line-height: 1;
  }
  .nav-btn:hover { color: var(--text); }
  .day-headers {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 2px;
  }
  .day-header {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    padding: 2px 0;
  }
  .day-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;
  }
  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 0;
    border-radius: 4px;
    cursor: pointer;
    min-height: 26px;
  }
  .day-cell:not(.empty):hover { background: var(--bg3); }
  .day-cell.empty { cursor: default; }
  .day-cell.in-week { background: rgba(var(--primary-rgb), 0.08); }
  .day-cell.in-week:hover { background: rgba(var(--primary-rgb), 0.15); }
  .day-num {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    border-radius: 50%;
  }
  .day-cell.today .day-num {
    background: var(--primary);
    color: var(--bg);
    font-weight: 700;
  }
  .day-dots {
    display: flex;
    gap: 2px;
    margin-top: 1px;
    min-height: 4px;
  }
  .dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
  }
  .upcoming-section {
    margin-top: 14px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .upcoming-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .upcoming-task {
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  .upcoming-task:last-child { border-bottom: none; }
  .task-title {
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .task-due { font-size: 10px; color: var(--muted); margin-top: 1px; }
</style>
