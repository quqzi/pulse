<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, sessions, todayHours, streak, dueCards, loadData } from '$lib/stores/data';
  import { settings } from '$lib/stores/settings';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import StudyTrendChart from '$lib/components/analytics/StudyTrendChart.svelte';
  import { sessionsRepo } from '$lib/data/entities';
  import type { StudySession } from '$lib/types';

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const weekStartISO = getWeekStart(new Date()).toISOString();

  $: weekSessions = $sessions.filter(s => s.startedAt >= weekStartISO);
  $: weekHours = weekSessions.reduce((sum, s) => sum + s.durationSec / 3600, 0);
  $: dueCount = $dueCards.length;
  $: totalCards = $srsCards.length;

  $: subjectBreakdown = (() => {
    const map: Record<string, number> = {};
    weekSessions.forEach(s => { map[s.subjectId] = (map[s.subjectId] || 0) + s.durationSec / 3600; });
    return $subjects
      .map(sub => ({ subject: sub, hours: map[sub.id] || 0 }))
      .filter(x => x.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  })();

  $: maxSubjectHours = Math.max(...subjectBreakdown.map(x => x.hours), 0.01);

  $: topicToSubjectId = Object.fromEntries($topics.map(t => [t.id, t.subjectId]));

  $: srsBySubject = (() => {
    const map: Record<string, number> = {};
    $srsCards.forEach(card => {
      if (card.dueDate > todayStr) return;
      const subId = topicToSubjectId[card.topicId];
      if (subId) map[subId] = (map[subId] || 0) + 1;
    });
    return map;
  })();

  $: subjectsWithCards = $subjects.filter(sub =>
    $srsCards.some(c => topicToSubjectId[c.topicId] === sub.id)
  );

  function fmtH(h: number): string {
    if (h === 0) return '0h';
    if (h < 1) return `${Math.round(h * 60)}m`;
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm ? `${hh}h ${mm}m` : `${hh}h`;
  }

  onMount(() => loadData($auth));

  $: if ($auth.mode !== 'loading') loadData($auth);

  let editingSessionId: string | null = null;
  let editSessionSubjectId = '';
  let editSessionMinutes = 0;
  let deleteSessionOpen = false;
  let pendingDeleteSession: StudySession | null = null;

  $: recentSessions = [...$sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20);

  function subjectColor(subjectId: string): string {
    return $subjects.find(s => s.id === subjectId)?.color ?? 'var(--muted)';
  }
  function subjectName(subjectId: string): string {
    return $subjects.find(s => s.id === subjectId)?.name ?? 'Unknown';
  }
  function formatDur(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function startEditSession(session: StudySession) {
    editingSessionId = session.id;
    editSessionSubjectId = session.subjectId;
    editSessionMinutes = Math.round(session.durationSec / 60);
  }
  async function saveEditSession() {
    const session = $sessions.find(s => s.id === editingSessionId);
    if (!session) { editingSessionId = null; return; }
    const updated: StudySession = { ...session, subjectId: editSessionSubjectId, durationSec: editSessionMinutes * 60 };
    await sessionsRepo.save(updated);
    editingSessionId = null;
  }
  function promptDeleteSession(session: StudySession) {
    pendingDeleteSession = session;
    deleteSessionOpen = true;
  }
  async function doDeleteSession() {
    if (!pendingDeleteSession) return;
    await sessionsRepo.remove(pendingDeleteSession.id);
    pendingDeleteSession = null;
  }
</script>

<div class="analytics-page">
  <h1 class="page-title">Analytics</h1>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-label">Today</div>
      <div class="stat-value">{fmtH($todayHours)}</div>
      <div class="stat-sub">Goal: {$settings.dailyGoalHours}h</div>
      <div class="stat-bar">
        <div class="stat-bar-fill" style="width: {Math.min(100, ($todayHours / $settings.dailyGoalHours) * 100)}%;"></div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Streak</div>
      <div class="stat-value">{$streak}<span class="stat-unit">d</span></div>
      <div class="stat-sub">{$streak > 0 ? 'Keep it up!' : 'Study today'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">This Week</div>
      <div class="stat-value">{fmtH(weekHours)}</div>
      <div class="stat-sub">Goal: {$settings.dailyGoalHours * 7}h</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">SRS Due</div>
      <div class="stat-value" class:urgent={dueCount > 0}>{dueCount}</div>
      <div class="stat-sub">{totalCards} cards total</div>
    </div>
  </div>

  <section class="section">
    <div class="section-header">
      <span class="section-label">STUDY TREND</span>
      <span class="section-sub">Last 14 days</span>
    </div>
    <StudyTrendChart />
  </section>

  {#if subjectBreakdown.length > 0}
    <section class="section">
      <div class="section-header">
        <span class="section-label">THIS WEEK BY SUBJECT</span>
        <span class="section-sub">{fmtH(weekHours)} total</span>
      </div>
      <div class="card">
        {#each subjectBreakdown as { subject, hours }, i}
          <div class="subject-row" class:not-first={i > 0}>
            <div class="subject-meta">
              <span class="subject-dot" style="background: {subject.color};"></span>
              <span class="subject-name">{subject.name}</span>
              <span class="subject-hours">{fmtH(hours)}</span>
              <span class="subject-pct">{Math.round((hours / weekHours) * 100)}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: {(hours / maxSubjectHours) * 100}%; background: {subject.color};"></div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if subjectsWithCards.length > 0}
    <section class="section">
      <div class="section-header">
        <span class="section-label">SRS HEALTH</span>
        <span class="section-sub">{dueCount} due today</span>
      </div>
      <div class="srs-grid">
        {#each subjectsWithCards as sub}
          {@const due = srsBySubject[sub.id] || 0}
          {@const cards = $srsCards.filter(c => topicToSubjectId[c.topicId] === sub.id).length}
          <div class="srs-card" style="--sc: {sub.color};">
            <div class="srs-top">
              <span class="srs-dot" style="background: {sub.color};"></span>
              <span class="srs-name">{sub.name}</span>
            </div>
            <div class="srs-due" class:has-due={due > 0}>{due > 0 ? due : '✓'}</div>
            <div class="srs-sub">{due > 0 ? 'due' : 'caught up'} · {cards} cards</div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="sessions-section">
    <h2 class="section-title">Recent Sessions</h2>
    {#if recentSessions.length === 0}
      <p class="empty-sessions">No sessions yet.</p>
    {:else}
      {#each recentSessions as session (session.id)}
        {#if editingSessionId === session.id}
          <div class="session-edit-row">
            <select class="sess-edit-input" bind:value={editSessionSubjectId}>
              {#each $subjects as s}
                <option value={s.id}>{s.name}</option>
              {/each}
            </select>
            <input type="number" class="sess-edit-input dur-input" bind:value={editSessionMinutes} min="1" max="480" />
            <span class="dur-label">min</span>
            <button class="btn-save-sm" on:click={saveEditSession}>Save</button>
            <button class="btn-cancel-sm" on:click={() => editingSessionId = null}>Cancel</button>
          </div>
        {:else}
          <div class="session-row">
            <span class="session-dot" style="background: {subjectColor(session.subjectId)};"></span>
            <span class="session-subject">{subjectName(session.subjectId)}</span>
            <span class="session-dur">{formatDur(session.durationSec)}</span>
            <span class="session-date">{formatDate(session.startedAt)}</span>
            <button class="icon-btn-sm" on:click={() => startEditSession(session)} aria-label="Edit session">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn-sm danger-btn" on:click={() => promptDeleteSession(session)} aria-label="Delete session">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        {/if}
      {/each}
    {/if}
  </section>

  <div class="bottom-spacer"></div>
</div>

<ConfirmDialog
  bind:open={deleteSessionOpen}
  title="Delete session?"
  message="This study session will be permanently removed."
  on:confirm={doDeleteSession}
/>

<style>
  .analytics-page { padding: 20px 16px 0; max-width: 720px; margin: 0 auto; }
  .page-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: var(--text); }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 24px;
  }
  @media (max-width: 540px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }

  .stat-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px;
  }
  .stat-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .stat-value {
    font-size: 26px;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
    color: var(--text);
  }
  .stat-unit { font-size: 16px; font-weight: 500; }
  .stat-value.urgent { color: var(--warning); }
  .stat-sub { font-size: 11px; color: var(--muted); }
  .stat-bar { height: 3px; background: var(--border); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  .stat-bar-fill { height: 100%; border-radius: 2px; background: var(--primary); transition: width 0.4s ease; }

  .section { margin-bottom: 20px; }
  .section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .section-sub { font-size: 11px; color: var(--muted); }

  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); }

  .subject-row { padding: 11px 16px; }
  .subject-row.not-first { border-top: 1px solid var(--border); }
  .subject-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
  .subject-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .subject-name { font-size: 13px; font-weight: 500; flex: 1; color: var(--text); }
  .subject-hours { font-size: 12px; color: var(--muted); }
  .subject-pct { font-size: 11px; color: var(--muted); min-width: 32px; text-align: right; }
  .bar-track { height: 4px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; opacity: 0.8; transition: width 0.4s ease; }

  .srs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
  .srs-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--sc);
    border-radius: var(--radius-md);
    padding: 12px;
  }
  .srs-top { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
  .srs-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .srs-name { font-size: 11px; font-weight: 600; color: var(--text); }
  .srs-due { font-size: 22px; font-weight: 700; color: var(--muted); line-height: 1; margin-bottom: 3px; }
  .srs-due.has-due { color: var(--warning); }
  .srs-sub { font-size: 10px; color: var(--muted); }

  .bottom-spacer { height: 40px; }

  .sessions-section { margin-top: 32px; padding-bottom: 32px; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
  .session-row {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 0; border-bottom: 1px solid var(--border);
  }
  .session-edit-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap;
  }
  .session-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .session-subject { flex: 1; font-size: 13px; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .session-dur { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .session-date { font-size: 12px; color: var(--muted); min-width: 55px; text-align: right; flex-shrink: 0; }
  .icon-btn-sm {
    background: none; border: none; color: var(--muted); cursor: pointer;
    padding: 3px; border-radius: 4px; line-height: 0; flex-shrink: 0;
  }
  .icon-btn-sm:hover { color: var(--text); background: var(--bg3); }
  .danger-btn:hover { color: var(--danger) !important; }
  .sess-edit-input {
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
    padding: 4px 8px; font-size: 13px; color: var(--text); font-family: inherit;
  }
  .dur-input { width: 60px; }
  .dur-label { font-size: 12px; color: var(--muted); }
  .btn-save-sm {
    padding: 4px 10px; border-radius: 6px; border: none;
    background: var(--primary); color: var(--bg); font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
  }
  .btn-cancel-sm {
    padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg3); color: var(--muted); font-size: 12px; cursor: pointer; font-family: inherit;
  }
  .empty-sessions { font-size: 13px; color: var(--muted); padding: 12px 0; }
</style>
