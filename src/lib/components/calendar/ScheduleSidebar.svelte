<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import { localDateStr } from '$lib/utils';
  import type { ScheduleSlot, Subject, SrsCard, Topic } from '$lib/types';
  import type { Settings } from '$lib/stores/settings';

  export let slots: ScheduleSlot[] = [];
  export let subjects: Subject[] = [];
  export let topics: Topic[] = [];
  export let srsCards: SrsCard[] = [];
  export let settings: Settings | null = null;
  export let weekStart: Date = new Date();

  const dispatch = createEventDispatcher<{ acceptAll: void; rejectAll: void }>();

  $: weekEnd = (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); return d; })();
  $: weekEndStr = localDateStr(weekEnd);
  $: todayStr = localDateStr(new Date());

  $: confirmedSlots = slots.filter(s => s.isConfirmed && !s.isAiSuggested);
  $: suggestedSlots = slots.filter(s => s.isAiSuggested && !s.isConfirmed);

  $: totalPlannedMinutes = confirmedSlots.reduce((sum, s) => {
    return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000;
  }, 0);

  $: weeklyGoalMinutes = settings ? settings.dailyGoalHours * 7 * 60 : 0;
  $: plannedRatio = weeklyGoalMinutes > 0 ? Math.min(totalPlannedMinutes / weeklyGoalMinutes, 1) : 0;

  $: minutesToLabel = (min: number): string => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0
      ? `${h}${$t.schedule.unitH}${m > 0 ? ` ${m}${$t.schedule.unitM}` : ''}`
      : `${m}${$t.schedule.unitM}`;
  };

  $: subjectStats = subjects.map(subject => {
    const mins = confirmedSlots
      .filter(s => s.subjectId === subject.id)
      .reduce((sum, s) => sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000, 0);
    return { subject, mins };
  }).filter(x => x.mins > 0).sort((a, b) => b.mins - a.mins);

  $: maxSubjectMins = Math.max(...subjectStats.map(x => x.mins), 1);

  $: topicToSubject = topics.reduce<Record<string, string>>((acc, tp) => {
    acc[tp.id] = tp.subjectId;
    return acc;
  }, {});

  $: weekSrsCards = srsCards.filter(c => c.dueDate <= weekEndStr && c.dueDate >= todayStr);
  $: srsDueCount = weekSrsCards.length;

  $: srsBySubject = subjects.map(subject => ({
    subject,
    count: weekSrsCards.filter(c => topicToSubject[c.topicId] === subject.id).length,
  })).filter(x => x.count > 0);
</script>

<aside class="schedule-sidebar">
  <section class="sidebar-section">
    <div class="section-label">{$t.schedule.thisWeek}</div>
    <div class="week-stat">
      <span class="stat-big">{minutesToLabel(totalPlannedMinutes)}</span>
      <span class="stat-goal">{settings ? $t.schedule.goalSuffix(`${settings.dailyGoalHours * 7}${$t.schedule.unitH}`) : '—'}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="transform: scaleX({plannedRatio});"></div>
    </div>
  </section>

  {#if subjectStats.length > 0}
  <section class="sidebar-section">
    <div class="section-label">{$t.schedule.bySubject}</div>
    {#each subjectStats as { subject, mins }}
      <div class="subject-row">
        <span class="subject-dot" style="background: {subject.color};"></span>
        <span class="subject-name">{subject.name}</span>
        <span class="subject-mins">{minutesToLabel(mins)}</span>
      </div>
      <div class="subject-bar-track">
        <div class="subject-bar-fill" style="width: {(mins / maxSubjectMins) * 100}%; background: {subject.color};"></div>
      </div>
    {/each}
  </section>
  {/if}

  {#if srsDueCount > 0}
  <section class="sidebar-section">
    <div class="section-label">{$t.schedule.srsDueThisWeek}</div>
    <div class="srs-count">{$t.schedule.cardsCount(srsDueCount)}</div>
    {#each srsBySubject as { subject, count }}
      <div class="srs-row">
        <span class="subject-dot" style="background: {subject.color};"></span>
        <span class="subject-name">{subject.name}</span>
        <span class="srs-badge">{count}</span>
      </div>
    {/each}
  </section>
  {/if}

  {#if suggestedSlots.length > 0}
  <section class="sidebar-section">
    <div class="section-label">{$t.schedule.aiSuggestions}</div>
    <div class="suggestion-count">{$t.schedule.blocksPending(suggestedSlots.length)}</div>
    <div class="suggestion-actions">
      <button class="action-btn accept-all" on:click={() => dispatch('acceptAll')}>{$t.schedule.acceptAll}</button>
      <button class="action-btn reject-all" on:click={() => dispatch('rejectAll')}>{$t.schedule.rejectAll}</button>
    </div>
  </section>
  {/if}
</aside>

<style>
.schedule-sidebar {
  width: 180px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg2);
  overflow-y: auto;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
}
.sidebar-section {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 8px;
}
.week-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 6px;
}
.stat-big { font-size: 20px; font-weight: 700; color: var(--text); }
.stat-goal { font-size: 12px; color: var(--muted); }
.progress-bar { height: 4px; border-radius: 2px; background: var(--bg3); overflow: hidden; }
.progress-fill { height: 100%; width: 100%; background: var(--primary); border-radius: 2px; transform-origin: left; transition: transform 0.3s ease; }
.subject-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  margin-bottom: 3px;
}
.subject-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.subject-name { flex: 1; font-size: 11px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.subject-mins { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.subject-bar-track { height: 3px; border-radius: 2px; background: var(--bg3); overflow: hidden; margin-bottom: 2px; }
.subject-bar-fill { height: 100%; border-radius: 2px; opacity: 0.75; }
.srs-count { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
.srs-row { display: flex; align-items: center; gap: 5px; margin-bottom: 4px; }
.srs-badge { margin-left: auto; font-size: 11px; font-weight: 600; background: var(--bg3); border-radius: 10px; padding: 0 6px; color: var(--text); }
.suggestion-count { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 10px; }
.suggestion-actions { display: flex; flex-direction: column; gap: 6px; }
.action-btn { width: 100%; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); text-align: center; }
.action-btn.accept-all { background: var(--primary); color: var(--bg); border-color: var(--primary); }
.action-btn.reject-all { background: var(--bg3); color: var(--muted); }
.action-btn:hover { opacity: 0.85; }
</style>
