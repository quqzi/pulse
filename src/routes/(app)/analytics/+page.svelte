<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, sessions, todayHours, streak, dueCards, loadData } from '$lib/stores/data';
  import { settings } from '$lib/stores/settings';

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

  $: dailyData = (() => {
    const days: { label: string; hours: number; isToday: boolean }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const hours = $sessions
        .filter(s => s.startedAt.startsWith(dateStr))
        .reduce((sum, s) => sum + s.durationSec / 3600, 0);
      const label = i === 0
        ? 'Today'
        : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      days.push({ label, hours, isToday: i === 0 });
    }
    return days;
  })();

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

  let canvas: HTMLCanvasElement;
  let chart: any = null;

  async function buildChart() {
    if (!canvas) return;
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);
    if (chart) { chart.destroy(); chart = null; }

    const cs = getComputedStyle(document.documentElement);
    const primaryRgb = cs.getPropertyValue('--primary-rgb').trim() || '23,23,23';
    const mutedColor = cs.getPropertyValue('--muted').trim();
    const borderColor = cs.getPropertyValue('--border').trim();

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: dailyData.map(d => d.label),
        datasets: [{
          data: dailyData.map(d => +d.hours.toFixed(2)),
          backgroundColor: dailyData.map(d =>
            d.isToday ? `rgba(${primaryRgb},0.9)` : `rgba(${primaryRgb},0.35)`
          ),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => fmtH(ctx.parsed.y) } },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: mutedColor, font: { size: 10 }, maxRotation: 0 },
          },
          y: {
            beginAtZero: true,
            grid: { color: borderColor },
            border: { display: false },
            ticks: { color: mutedColor, font: { size: 10 }, callback: (v: any) => `${v}h` },
          },
        },
      },
    });
  }

  onMount(async () => {
    await loadData($auth);
    buildChart();
  });

  $: if ($auth.mode !== 'loading') loadData($auth);

  onDestroy(() => { chart?.destroy(); });

  let prevKey = '';
  $: {
    const key = dailyData.map(d => d.hours.toFixed(2)).join(',');
    if (key !== prevKey && chart) {
      prevKey = key;
      chart.data.datasets[0].data = dailyData.map(d => +d.hours.toFixed(2));
      chart.update('none');
    }
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
    <div class="card chart-card">
      <canvas bind:this={canvas}></canvas>
    </div>
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

  <div class="bottom-spacer"></div>
</div>

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
  .stat-value.urgent { color: #f59e0b; }
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
  .chart-card { padding: 16px; height: 200px; }
  .chart-card canvas { width: 100% !important; height: 100% !important; }

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
  .srs-due.has-due { color: #f59e0b; }
  .srs-sub { font-size: 10px; color: var(--muted); }

  .bottom-spacer { height: 40px; }
</style>
