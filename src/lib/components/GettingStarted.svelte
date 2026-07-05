<script lang="ts">
  import { settings } from '$lib/stores/settings';
  import { subjects, sessions, scheduleSlots } from '$lib/stores/data';
  import { auth } from '$lib/stores/auth';
  import { t } from '$lib/i18n';

  $: steps = [
    { key: 'addSubjects' as const, href: '/subjects', done: $subjects.length > 0 },
    { key: 'setExamDate' as const, href: '/settings', done: ($settings.exams?.length ?? 0) > 0 || !!$settings.examDate },
    { key: 'planWeek' as const, href: '/schedule', done: $scheduleSlots.length > 0 },
    { key: 'studyOnce' as const, href: '/timer', done: $sessions.length > 0 },
  ];
  $: doneCount = steps.filter((s) => s.done).length;
  $: allDone = doneCount === steps.length;
  $: visible = !$settings.gettingStartedDismissed && !allDone;

  function dismiss() {
    settings.update((s) => ({ ...s, gettingStartedDismissed: true }));
  }
</script>

{#if visible}
  <section class="gs-card card">
    <div class="gs-head">
      <div>
        <p class="gs-title">{$t.gettingStarted.title}</p>
        <p class="gs-progress">{$t.gettingStarted.progress(doneCount, steps.length)}</p>
      </div>
      <button class="gs-dismiss" on:click={dismiss} aria-label={$t.gettingStarted.dismiss}>✕</button>
    </div>
    <ol class="gs-steps">
      {#each steps as step, i (step.key)}
        <li>
          {#if step.done}
            <span class="gs-step done">
              <span class="gs-num done" aria-hidden="true">✓</span>
              <span class="gs-label">{$t.gettingStarted[step.key]}</span>
            </span>
          {:else}
            <a class="gs-step" href={step.href}>
              <span class="gs-num" aria-hidden="true">{i + 1}</span>
              <span class="gs-label">{$t.gettingStarted[step.key]}</span>
              <span class="gs-go" aria-hidden="true">›</span>
            </a>
          {/if}
        </li>
      {/each}
    </ol>
    {#if $auth.mode === 'guest'}
      <a class="gs-signin" href="/auth">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
        </svg>
        <span>{$t.gettingStarted.signIn}</span>
        <span class="gs-go" aria-hidden="true">›</span>
      </a>
    {/if}
  </section>
{/if}

<style>
  .gs-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px; }
  .gs-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
  .gs-title { font-size: 15px; font-weight: 700; color: var(--text); margin: 0; }
  .gs-progress { font-size: 12px; color: var(--muted); margin: 2px 0 0; }
  .gs-dismiss { border: none; background: none; color: var(--muted); font-size: 14px; cursor: pointer; min-width: 32px; min-height: 32px; border-radius: 8px; }
  .gs-dismiss:hover { background: var(--bg3); color: var(--text); }
  .gs-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .gs-step { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; text-decoration: none; color: var(--text); min-height: 40px; }
  a.gs-step:hover { background: var(--bg3); }
  .gs-step.done { color: var(--muted); }
  .gs-step.done .gs-label { text-decoration: line-through; }
  .gs-num {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary-l); color: var(--primary); font-size: 11px; font-weight: 700;
  }
  .gs-num.done { background: var(--bg3); color: var(--muted); }
  .gs-label { font-size: 14px; flex: 1; }
  .gs-go { color: var(--muted); font-size: 16px; }
  .gs-signin {
    display: flex; align-items: center; gap: 8px;
    margin-top: 8px; padding: 9px 8px; border-radius: 8px;
    border-top: 1px dashed var(--border);
    text-decoration: none; color: var(--muted); font-size: 13px;
  }
  .gs-signin:hover { background: var(--bg3); color: var(--text); }
  .gs-signin span:first-of-type { flex: 1; }
  .gs-signin svg { flex-shrink: 0; }
</style>
