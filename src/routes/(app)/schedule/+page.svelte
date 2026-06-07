<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, tasks, sessions, scheduleSlots, loadData, loadScheduleSlots, getAuthContext } from '$lib/stores/data';
  import { settings } from '$lib/stores/settings';
  import { newId } from '$lib/id';
  import { scheduleRepo } from '$lib/data/entities';
  import { generateSchedule } from '$lib/scheduler';
  import WeekGrid from '$lib/components/calendar/WeekGrid.svelte';
  import MiniMonth from '$lib/components/calendar/MiniMonth.svelte';
  import ScheduleSidebar from '$lib/components/calendar/ScheduleSidebar.svelte';
  import ExamBanner from '$lib/components/calendar/ExamBanner.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import { pendingAiCount } from '$lib/pendingAiCount';
  import { t, fmt } from '$lib/i18n';
  import type { ScheduleSlot } from '$lib/types';

  // ── Week navigation ───────────────────────────────────────────
  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  let viewedWeekStart = getWeekStart(new Date());

  $: weekEnd = (() => {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() + 7);
    return d;
  })();

  $: weekTitle = $fmt.date(viewedWeekStart.toISOString(), { month: 'long', year: 'numeric' });

  function prevWeek() {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() - 7);
    viewedWeekStart = d;
  }

  function nextWeek() {
    const d = new Date(viewedWeekStart);
    d.setDate(d.getDate() + 7);
    viewedWeekStart = d;
  }

  function goToday() {
    viewedWeekStart = getWeekStart(new Date());
  }

  // ── Auto-schedule ─────────────────────────────────────────────
  let isScheduling = false;

  // ── Mobile bottom sheet ───────────────────────────────────────
  let sheetOpen = false;
  $: aiPending = pendingAiCount($scheduleSlots);

  function handleAutoSchedule() {
    if (isScheduling) return;
    isScheduling = true;
    let filteredSlots: ScheduleSlot[] = [];
    scheduleSlots.update(all => {
      filteredSlots = all.filter(s => !s.isAiSuggested);
      return filteredSlots;
    });
    const { userId } = getAuthContext();
    const suggested = generateSchedule({
      weekStart: viewedWeekStart,
      subjects: $subjects,
      topics: $topics,
      sessions: $sessions,
      srsCards: $srsCards,
      tasks: $tasks,
      existingSlots: filteredSlots,
      settings: $settings,
      examDate: $settings.examDate,
    }).map(s => ({ ...s, userId }));
    scheduleSlots.update(all => [...all, ...suggested]);
    isScheduling = false;
  }

  // ── Event handlers ────────────────────────────────────────────
  async function handleCreateSlot(e: CustomEvent) {
    const { userId } = getAuthContext();
    const { subjectId, topicId, startTime, endTime, isFocusBlock } = e.detail;
    const slot: ScheduleSlot = {
      id: newId(),
      userId,
      subjectId,
      topicId,
      startTime,
      endTime,
      isAiSuggested: false,
      isConfirmed: true,
      isFocusBlock: isFocusBlock ?? false,
      isRecurring: false,
      recurrenceDays: [],
      createdAt: new Date().toISOString(),
    };
    await scheduleRepo.save(slot);
  }

  async function handleMoveSlot(e: CustomEvent) {
    const { slotId, startTime, endTime } = e.detail;
    const slot = $scheduleSlots.find(s => s.id === slotId);
    if (!slot) return;
    await scheduleRepo.save({ ...slot, startTime, endTime });
  }

  async function handleResizeSlot(e: CustomEvent) {
    const { slotId, startTime, endTime } = e.detail;
    const slot = $scheduleSlots.find(s => s.id === slotId);
    if (!slot) return;
    await scheduleRepo.save({ ...slot, startTime, endTime });
  }

  async function handleDeleteSlot(e: CustomEvent) {
    const { slotId } = e.detail;
    await scheduleRepo.remove(slotId);
  }

  async function handleAcceptSlot(e: CustomEvent) {
    const { slotId } = e.detail;
    const slot = $scheduleSlots.find(s => s.id === slotId);
    if (!slot) return;
    await scheduleRepo.save({ ...slot, isConfirmed: true, isAiSuggested: false });
  }

  function handleDismissSlot(e: CustomEvent) {
    const { slotId } = e.detail;
    scheduleSlots.update(all => all.filter(s => s.id !== slotId));
  }

  function handleStartFocus(e: CustomEvent) {
    const { slot } = e.detail as { slot: ScheduleSlot };
    goto(`/timer?subjectId=${slot.subjectId}${slot.topicId ? `&topicId=${slot.topicId}` : ''}&mode=focus`);
  }

  async function handleChangeSubject(e: CustomEvent) {
    const { slotId, subjectId } = e.detail as { slotId: string; subjectId: string | undefined };
    const slot = $scheduleSlots.find(s => s.id === slotId);
    if (!slot) return;
    await scheduleRepo.save({ ...slot, subjectId, topicId: undefined });
  }

  async function handleAcceptAll() {
    const suggested = $scheduleSlots.filter(s => s.isAiSuggested && !s.isConfirmed);
    await scheduleRepo.confirmAll(suggested);
  }

  function handleRejectAll() {
    scheduleSlots.update(all => all.filter(s => !s.isAiSuggested));
  }

  onMount(async () => {
    await loadData($auth);
    loadScheduleSlots(viewedWeekStart, weekEnd);
  });

  $: if ($auth.mode !== 'loading') loadData($auth);
  // loadScheduleSlots must come after loadData so _userId/_mode are initialized
  $: if ($auth.mode !== 'loading') loadScheduleSlots(viewedWeekStart, weekEnd);
</script>

<div class="schedule-wrap">
  <!-- Left panel: mini month + upcoming -->
  <aside class="left-panel">
    <MiniMonth
      currentWeekStart={viewedWeekStart}
      sessions={$sessions}
      tasks={$tasks}
      subjects={$subjects}
      on:weekSelect={(e) => { viewedWeekStart = e.detail; }}
    />
  </aside>

  <!-- Main calendar area -->
  <div class="main-area">
    <ExamBanner subjects={$subjects} sessions={$sessions} settings={$settings} examDate={$settings.examDate} />

    <header class="cal-header">
      <div class="week-nav">
        <button class="nav-btn icon-btn" on:click={prevWeek} aria-label={$t.schedule.prevWeek}>‹</button>
        <button class="nav-btn icon-btn" on:click={nextWeek} aria-label={$t.schedule.nextWeek}>›</button>
        <span class="week-title">{weekTitle}</span>
        <button class="today-btn" on:click={goToday}>{$t.schedule.today}</button>
      </div>
      <div class="header-actions">
        <button
          class="auto-btn"
          class:loading={isScheduling}
          on:click={handleAutoSchedule}
          disabled={isScheduling}
        >
          {isScheduling ? $t.schedule.scheduling : $t.schedule.autoSchedule}
        </button>
      </div>
    </header>

    <WeekGrid
      weekStart={viewedWeekStart}
      slots={$scheduleSlots}
      subjects={$subjects}
      topics={$topics}
      tasks={$tasks}
      settings={$settings}
      on:createSlot={handleCreateSlot}
      on:moveSlot={handleMoveSlot}
      on:resizeSlot={handleResizeSlot}
      on:deleteSlot={handleDeleteSlot}
      on:acceptSlot={handleAcceptSlot}
      on:dismissSlot={handleDismissSlot}
      on:startFocus={handleStartFocus}
      on:changeSubject={handleChangeSubject}
    />

    <button class="summary-tab" on:click={() => (sheetOpen = true)}>
      <span>{$t.schedule.weekSummary}</span>
      {#if aiPending > 0}<span class="ai-pill">{$t.schedule.aiPill(aiPending)}</span>{/if}
    </button>
  </div>

  <ScheduleSidebar
    slots={$scheduleSlots}
    subjects={$subjects}
    topics={$topics}
    srsCards={$srsCards}
    settings={$settings}
    weekStart={viewedWeekStart}
    on:acceptAll={handleAcceptAll}
    on:rejectAll={handleRejectAll}
  />
</div>

<BottomSheet open={sheetOpen} on:close={() => (sheetOpen = false)}>
  <ScheduleSidebar
    slots={$scheduleSlots}
    subjects={$subjects}
    topics={$topics}
    srsCards={$srsCards}
    settings={$settings}
    weekStart={viewedWeekStart}
    on:acceptAll={handleAcceptAll}
    on:rejectAll={handleRejectAll}
  />
  <MiniMonth
    currentWeekStart={viewedWeekStart}
    sessions={$sessions}
    tasks={$tasks}
    subjects={$subjects}
    on:weekSelect={(e) => { viewedWeekStart = e.detail; sheetOpen = false; }}
  />
</BottomSheet>

<style>
  .schedule-wrap {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
  }

  .left-panel {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    background: var(--bg2);
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }

  .cal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 12px;
    background: var(--bg2);
  }

  .week-nav {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .week-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 4px;
    min-width: 140px;
  }

  .nav-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px 8px;
  }
  .nav-btn:hover { background: var(--bg3); }

  .today-btn {
    font-size: 12px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    margin-left: 4px;
  }
  .today-btn:hover { background: var(--bg3); }

  .header-actions { display: flex; align-items: center; gap: 8px; }

  .auto-btn {
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1.5px solid var(--primary);
    background: var(--primary);
    color: var(--bg);
    cursor: pointer;
    letter-spacing: 0.01em;
  }
  .auto-btn:hover:not(:disabled) { opacity: 0.88; }
  .auto-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .auto-btn.loading { opacity: 0.7; }

  .summary-tab { display: none; }

  @media (max-width: 768px) {
    .left-panel { display: none; }
    :global(.schedule-sidebar) { display: none !important; }
    /* but show it when relocated inside the bottom sheet */
    :global(.sheet-content .schedule-sidebar) { display: block !important; }
    .main-area { overflow-x: auto; -webkit-overflow-scrolling: touch; }

    .summary-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-shrink: 0;
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-top: 1px solid var(--border);
      background: var(--bg2);
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .ai-pill {
      background: var(--warning, #e5a23c);
      color: var(--bg);
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 8px;
    }
  }
</style>
