<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, sessions, streak, loadData } from '$lib/stores/data';
  import HeatmapGrid from '$lib/components/journey/HeatmapGrid.svelte';
  import { formatDuration, localDateStr } from '$lib/utils';

  const TIMELINE_PAGE_SIZE = 30;

  $: totalHours = $sessions.reduce((sum, s) => sum + s.durationSec / 3600, 0);
  $: totalSessions = $sessions.length;

  function formatHours(h: number): string {
    if (h < 1) return `${Math.round(h * 60)}m`;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm ? `${hh}h ${mm}m` : `${hh}h`;
  }

  type DayGroup = {
    dateStr: string;
    label: string;
    totalSec: number;
    sessions: typeof $sessions;
  };

  $: subjectMap = Object.fromEntries($subjects.map(s => [s.id, s]));
  $: topicMap = Object.fromEntries($topics.map(t => [t.id, t]));

  $: dayGroups = (() => {
    const map = new Map<string, typeof $sessions>();
    for (const s of $sessions) {
      const day = localDateStr(new Date(s.startedAt));
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    const days = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    return days.map(([dateStr, daySessions]) => {
      const d = new Date(dateStr + 'T00:00:00');
      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const totalSec = daySessions.reduce((sum, s) => sum + s.durationSec, 0);
      const sorted = [...daySessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      return { dateStr, label, totalSec, sessions: sorted };
    });
  })();

  let shownCount = TIMELINE_PAGE_SIZE;
  $: visibleDayGroups = dayGroups.slice(0, shownCount);
  $: hasMore = dayGroups.length > shownCount;
  $: remainingDays = dayGroups.length - shownCount;

  function showMore() { shownCount += TIMELINE_PAGE_SIZE; }

  function formatTimeRange(startedAt: string, endedAt: string): string {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${fmt(startedAt)} – ${fmt(endedAt)}`;
  }

  const MODE_LABELS: Record<string, string> = {
    pomodoro: 'Pomodoro',
    free: 'Free',
    quick: 'Quick',
  };

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

<div class="journey-page">
  <h1 class="page-title">Journey</h1>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Total Time</div>
      <div class="stat-value">{formatHours(totalHours)}</div>
      <div class="stat-sub">all-time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Streak</div>
      <div class="stat-value">{$streak}<span class="stat-unit">d</span></div>
      <div class="stat-sub">{$streak > 0 ? 'Keep going!' : 'Study today to start'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sessions</div>
      <div class="stat-value">{totalSessions}</div>
      <div class="stat-sub">all-time</div>
    </div>
  </div>

  <section class="section">
    <div class="section-header">
      <span class="section-label">ACTIVITY</span>
      <span class="section-sub">Last 16 weeks</span>
    </div>
    <div class="card heatmap-card">
      <HeatmapGrid sessions={$sessions} />
    </div>
  </section>

  <section class="section">
    <div class="section-header">
      <span class="section-label">SESSIONS</span>
      <span class="section-sub">{totalSessions} total</span>
    </div>

    {#if dayGroups.length === 0}
      <div class="empty-state">
        <p class="empty-title">No study sessions yet.</p>
        <p class="empty-sub">Start your first session!</p>
      </div>
    {:else}
      <div class="timeline">
        {#each visibleDayGroups as group (group.dateStr)}
          <div class="day-group">
            <div class="day-header">
              <span class="day-label">{group.label}</span>
              <span class="day-total">{formatDuration(group.totalSec)}</span>
            </div>
            <div class="card session-list">
              {#each group.sessions as session, si (session.id)}
                {#if si > 0}
                  <div class="session-divider"></div>
                {/if}
                {@const subject = subjectMap[session.subjectId]}
                {@const topic = session.topicId ? topicMap[session.topicId] : undefined}
                <div class="session-row">
                  <div
                    class="subject-badge"
                    class:unknown-subject={!subject}
                    style={subject ? `background: rgba(${subject.colorRgb}, 0.12); color: ${subject.color};` : ''}
                  >
                    {subject?.symbol ?? '?'}
                  </div>
                  <div class="session-meta">
                    <div class="session-top">
                      <span class="subject-name">{subject?.name ?? 'Unknown'}</span>
                      {#if topic}
                        <span class="topic-name">· {topic.name}</span>
                      {/if}
                    </div>
                    <div class="session-bottom">
                      <span class="session-time">{formatTimeRange(session.startedAt, session.endedAt)}</span>
                    </div>
                  </div>
                  <div class="session-right">
                    <span class="session-duration">{formatDuration(session.durationSec)}</span>
                    <span class="mode-badge mode-{session.mode}">{MODE_LABELS[session.mode] ?? session.mode}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}

        {#if hasMore}
          <div class="show-more">
            <button class="show-more-btn" on:click={showMore}>Show {remainingDays} more day{remainingDays === 1 ? '' : 's'}</button>
          </div>
        {/if}
      </div>
    {/if}
  </section>

  <div class="bottom-spacer"></div>
</div>

<style>
  .journey-page { padding: 20px 16px 0; max-width: 720px; margin: 0 auto; }
  .page-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: var(--text); }

  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
  .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px; }
  .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 6px; }
  .stat-value { font-size: 26px; font-weight: 700; line-height: 1; margin-bottom: 4px; color: var(--text); }
  .stat-unit { font-size: 16px; font-weight: 500; }
  .stat-sub { font-size: 11px; color: var(--muted); }

  .section { margin-bottom: 20px; }
  .section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .section-sub { font-size: 11px; color: var(--muted); }

  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); }
  .heatmap-card { padding: 16px; }

  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }

  .timeline { display: flex; flex-direction: column; gap: 16px; }
  .day-group { display: flex; flex-direction: column; gap: 6px; }
  .day-header { display: flex; align-items: baseline; justify-content: space-between; padding: 0 2px; }
  .day-label { font-size: 13px; font-weight: 600; color: var(--text); }
  .day-total { font-size: 12px; color: var(--muted); }

  .session-list { overflow: hidden; }
  .session-divider { height: 1px; background: var(--border); margin: 0 14px; }
  .session-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; }

  .subject-badge { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .unknown-subject { background: rgba(var(--primary-rgb), 0.08); color: var(--muted); }

  .session-meta { flex: 1; min-width: 0; }
  .session-top { display: flex; align-items: baseline; gap: 4px; margin-bottom: 3px; }
  .subject-name { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .topic-name { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .session-bottom { display: flex; align-items: center; gap: 6px; }
  .session-time { font-size: 11px; color: var(--muted); }

  .session-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .session-duration { font-size: 14px; font-weight: 600; color: var(--text); }

  .mode-badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  .mode-pomodoro { background: rgba(var(--primary-rgb), 0.10); color: var(--primary); }
  .mode-free { background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }
  .mode-quick { background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }

  .show-more { text-align: center; padding: 12px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); }
  .show-more-btn { font-size: 13px; color: var(--muted); background: none; border: none; cursor: pointer; padding: 0; }
  .show-more-btn:hover { color: var(--text); }

  .bottom-spacer { height: 40px; }
</style>
