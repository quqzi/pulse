<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
  import {
    subjects, topics, srsCards, sessions,
    dueCards, todayHours, streak, loadData, getAuthContext
  } from '$lib/stores/data';
  import { setTimerSubject } from '$lib/stores/timer';
  import { cardTilt } from '$lib/effects';
  import HeroCard from '$lib/components/HeroCard.svelte';
  import SubjectTile from '$lib/components/SubjectTile.svelte';
  import TodaysPlan from '$lib/components/TodaysPlan.svelte';
  import QuickLog from '$lib/components/QuickLog.svelte';
  import { db } from '$lib/db';

  $: name = $auth.name;
  $: greeting = getGreeting();
  $: daysToExam = getDaysToExam();
  $: goalHours = $settings.dailyGoalHours;

  function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function getDaysToExam(): number | null {
    try {
      const raw = localStorage.getItem('pulse_exam_date');
      if (!raw) return null;
      const diff = new Date(raw).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / 86400000));
    } catch { return null; }
  }

  function handleStart(e: CustomEvent<{ subjectId: string; topicId: string }>) {
    setTimerSubject(e.detail.subjectId, e.detail.topicId);
    goto('/timer');
  }

  async function handleLog(e: CustomEvent<{ subjectId: string; topicId: string | undefined; durationMin: number }>) {
    const { subjectId, topicId, durationMin } = e.detail;
    const { userId, mode } = getAuthContext();
    const now = new Date();
    const startedAt = new Date(now.getTime() - durationMin * 60000);
    const session = {
      id: db.newId(),
      userId,
      subjectId,
      topicId,
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      durationSec: durationMin * 60,
      mode: 'quick' as const,
    };
    await db.logSession(session, mode);
    sessions.update(s => [session, ...s]);
  }

  onMount(() => loadData($auth));
</script>

<div class="page">
  <div class="greeting-row">
    <div>
      <h1 class="text-large-title">{greeting}, {name}</h1>
      <p class="text-body subtitle">
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        {#if daysToExam !== null}
          · <strong>{daysToExam}d</strong> to TCAS
        {/if}
      </p>
    </div>
  </div>

  <div use:cardTilt>
    <HeroCard todayHours={$todayHours} goalHours={$settings.dailyGoalHours} streak={$streak} />
  </div>

  {#if $subjects.length > 0}
    <section class="subjects-section">
      <div class="section-label">SUBJECTS</div>
      <div class="subjects-grid">
        {#each $subjects as subject (subject.id)}
          <SubjectTile
            {subject}
            topics={$topics}
            cards={$srsCards}
            on:click={() => goto(`/subjects/${subject.id}`)}
          />
        {/each}
      </div>
    </section>
  {/if}

  <TodaysPlan
    subjects={$subjects}
    topics={$topics}
    dueCards={$dueCards}
    on:start={handleStart}
  />

  <QuickLog
    subjects={$subjects}
    topics={$topics}
    on:log={handleLog}
  />

  <div class="bottom-spacer"></div>
</div>

<style>
  .page { padding: 20px 16px 0; max-width: 600px; margin: 0 auto; }
  .greeting-row { margin-bottom: 20px; }
  .subtitle { color: var(--muted); margin-top: 3px; }
  .subjects-section { margin-top: 24px; }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-bottom: 8px;
    padding: 0 2px;
  }
  .subjects-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  @media (max-width: 360px) {
    .subjects-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .bottom-spacer { height: 32px; }
</style>
