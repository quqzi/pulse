<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
  import {
    subjects, topics,
    dueDecks, todayHours, streak, loadData, getAuthContext,
    tasksDueToday,
  } from '$lib/stores/data';
  import { setTimerSubject } from '$lib/stores/timer';
  import { cardTilt } from '$lib/effects';
  import { localDateStr } from '$lib/utils';
  import HeroCard from '$lib/components/HeroCard.svelte';
  import GettingStarted from '$lib/components/GettingStarted.svelte';
  import ExamCountdown from '$lib/components/ExamCountdown.svelte';
  import SubjectTile from '$lib/components/SubjectTile.svelte';
  import TodaysPlan from '$lib/components/TodaysPlan.svelte';
  import QuickLog from '$lib/components/QuickLog.svelte';
  import ReadinessCard from '$lib/components/ReadinessCard.svelte';
  import { newId } from '$lib/id';
  import { tasksRepo, sessionsRepo } from '$lib/data/entities';
  import { t, fmt } from '$lib/i18n';

  $: name = $auth.name;
  $: greetingKey = greetingKeyFor(new Date().getHours());

  function greetingKeyFor(h: number): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
    if (h < 12) return 'goodMorning';
    if (h < 17) return 'goodAfternoon';
    return 'goodEvening';
  }

  function handleStart(e: CustomEvent<{ subjectId: string; topicId: string }>) {
    setTimerSubject(e.detail.subjectId, e.detail.topicId);
    goto('/timer');
  }

  async function handleLog(e: CustomEvent<{ subjectId: string; topicId: string | undefined; durationMin: number }>) {
    const { subjectId, topicId, durationMin } = e.detail;
    const { userId } = getAuthContext();
    const now = new Date();
    const startedAt = new Date(now.getTime() - durationMin * 60000);
    const session = {
      id: newId(),
      userId,
      subjectId,
      topicId,
      startedAt: startedAt.toISOString(),
      endedAt: now.toISOString(),
      durationSec: durationMin * 60,
      mode: 'quick' as const,
    };
    await sessionsRepo.log(session);
  }

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

<div class="page">
  <div class="greeting-row">
    <div>
      <h1 class="text-large-title">{$t.dashboard[greetingKey]}, {name}</h1>
      <p class="text-body subtitle">
        {$fmt.date(new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </div>
  </div>

  <GettingStarted />

  <ExamCountdown />

  <div use:cardTilt class="hero-wrap">
    <HeroCard todayHours={$todayHours} goalHours={$settings.dailyGoalHours} streak={$streak} />
  </div>

  <section class="readiness-section">
    <ReadinessCard />
  </section>

  {#if $subjects.length > 0}
    <section class="subjects-section">
      <div class="section-label">{$t.dashboard.subjects}</div>
      <div class="subjects-grid">
        {#each $subjects as subject (subject.id)}
          <SubjectTile
            {subject}
            topics={$topics}
            on:click={() => goto(`/subjects/${subject.id}`)}
          />
        {/each}
      </div>
    </section>
  {/if}

  {#if $dueDecks.length > 0}
    <section class="review-section">
      <button class="review-cta" on:click={() => goto('/flashcards')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>
          <path d="M7 9h6M7 13h4"/>
        </svg>
        {$t.dashboard.reviewDue($dueDecks.length)}
      </button>
    </section>
  {/if}

  <TodaysPlan
    subjects={$subjects}
    dueDecks={$dueDecks}
    on:start={handleStart}
  />

  {#if $tasksDueToday.length > 0}
    <section class="tasks-section">
      <div class="section-label">{$t.tasks.dueToday}</div>
      <div class="card tasks-card">
        {#each $tasksDueToday.slice(0, 5) as task (task.id)}
          <div class="task-row">
            <button class="dash-check" on:click={async () => {
              const updated = { ...task, completedAt: new Date().toISOString() };
              await tasksRepo.save(updated);
            }} aria-label={$t.tasks.markComplete}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="var(--border)" stroke-width="1.5"/>
              </svg>
            </button>
            <span class="dash-task-title">{task.title}</span>
            {#if task.dueDate}
              <span class="dash-due" class:overdue={task.dueDate < localDateStr(new Date())}>
                {$fmt.date(task.dueDate + 'T00:00:00', { month: 'short', day: 'numeric' })}
              </span>
            {/if}
          </div>
          {#if task !== $tasksDueToday.slice(0, 5).at(-1)}
            <div class="task-divider"></div>
          {/if}
        {/each}
        {#if $tasksDueToday.length > 5}
          <a href="/tasks" class="see-more">{$t.tasks.seeMore($tasksDueToday.length - 5)}</a>
        {/if}
      </div>
    </section>
  {/if}

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
  .hero-wrap { margin-top: 16px; }
  .readiness-section { margin-top: 16px; }
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
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .tasks-section { margin-top: 20px; }
  .tasks-card { padding: 4px 0; }
  .task-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
  .dash-check { background: none; border: none; cursor: pointer; padding: 0; flex-shrink: 0; line-height: 0; }
  .dash-task-title { flex: 1; font-size: 14px; font-weight: 500; color: var(--text); }
  .dash-due { font-size: 12px; color: var(--muted); flex-shrink: 0; }
  .dash-due.overdue { color: var(--danger); font-weight: 600; }
  .task-divider { height: 1px; background: var(--border); margin: 0 14px; }
  .see-more { display: block; text-align: center; padding: 8px; font-size: 13px; color: var(--primary); text-decoration: none; font-weight: 500; }
  .bottom-spacer { height: 32px; }
  .review-section { margin-top: 20px; }
  .review-cta {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 14px 16px;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    color: var(--primary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .review-cta:active { transform: scale(0.97); transition: transform 80ms ease-in; }
</style>
