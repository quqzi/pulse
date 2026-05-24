<script lang="ts">
  import { goto } from '$app/navigation';
  import { settings } from '$lib/stores/settings';
  import { ALL_BUILTIN_PRESETS } from '$lib/constants';
  import { db } from '$lib/db';
  import type { Subject } from '$lib/types';

  let step = 0;
  let examDate = '';
  const ALL_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Thai'];
  let selectedSubjects = [...ALL_SUBJECTS];
  let dailyGoalHours = 4;
  let targetScores: Record<string, number> = {};
  const TOTAL = 4;

  function next() { step < TOTAL ? step++ : finish(); }

  async function finish() {
    settings.update(s => ({ ...s, dailyGoalHours }));
    localStorage.setItem('pulse_exam_date', examDate);
    localStorage.setItem('pulse_target_scores', JSON.stringify(targetScores));
    localStorage.setItem('pulse_onboarded', '1');

    const subjectRecords: Subject[] = selectedSubjects.map((name, i) => {
      const preset = ALL_BUILTIN_PRESETS.get(name.toLowerCase());
      return {
        id: db.newId(),
        userId: 'guest',
        name,
        symbol: preset?.symbol ?? name.slice(0, 2),
        color: preset?.color ?? '#6366f1',
        colorRgb: preset?.colorRgb ?? '99,102,241',
        orderIndex: i,
        targetScore: targetScores[name],
      };
    });
    localStorage.setItem('pulse_subjects', JSON.stringify(subjectRecords));

    goto('/dashboard');
  }
</script>

<div class="ob-page">
  <div class="ob-card card">
    <div class="dots">
      {#each Array(TOTAL + 1) as _, i}
        <div class="dot" class:active={i === step} class:done={i < step}></div>
      {/each}
    </div>

    {#if step === 0}
      <h2 class="text-heading">When is your TCAS exam?</h2>
      <p class="text-body text-muted sub">We'll show a countdown and pace your study plan.</p>
      <input type="date" bind:value={examDate} class="field-input" />

    {:else if step === 1}
      <h2 class="text-heading">Which subjects are you studying?</h2>
      <p class="text-body text-muted sub">Uncheck any you don't need.</p>
      <div class="subject-list">
        {#each ALL_SUBJECTS as sub}
          <label class="subject-row">
            <input type="checkbox" bind:group={selectedSubjects} value={sub} />
            <span>{sub}</span>
          </label>
        {/each}
      </div>

    {:else if step === 2}
      <h2 class="text-heading">Daily study goal</h2>
      <p class="text-body text-muted sub">How many hours per day?</p>
      <div class="goal-num text-mono-stat text-primary">{dailyGoalHours}h</div>
      <input type="range" min="1" max="8" step="0.5" bind:value={dailyGoalHours} class="slider" />
      <div class="slider-ends"><span>1h</span><span>8h</span></div>

    {:else if step === 3}
      <h2 class="text-heading">Target scores <span class="text-muted" style="font-weight:400">(optional)</span></h2>
      <p class="text-body text-muted sub">Used in Analytics to show progress toward your goal.</p>
      <div class="score-list">
        {#each selectedSubjects as sub}
          <div class="score-row">
            <span class="text-body" style="flex:1">{sub}</span>
            <input type="number" min="0" max="100" placeholder="—" bind:value={targetScores[sub]} class="score-input" />
          </div>
        {/each}
      </div>

    {:else}
      <h2 class="text-heading">You're all set!</h2>
      <p class="text-body text-muted sub">Your study tracker is ready. Let's go.</p>
    {/if}

    <div class="actions">
      {#if step > 0}<button class="btn btn-secondary" on:click={() => step--}>Back</button>{/if}
      <button class="btn btn-primary" style="flex:1" on:click={next}>
        {step === TOTAL ? 'Get started' : 'Next'}
      </button>
    </div>

    {#if step === 0}
      <button class="skip-btn" on:click={finish}>Skip setup</button>
    {/if}
  </div>
</div>

<style>
  .ob-page { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); }
  .ob-card { width:100%; max-width:420px; padding:32px 28px; display:flex; flex-direction:column; gap:16px; }
  .dots { display:flex; gap:6px; }
  .dot { width:6px; height:6px; border-radius:999px; background:var(--border); transition:background 200ms ease, width 200ms ease; }
  .dot.active { background:var(--primary); width:18px; }
  .dot.done   { background:var(--primary); opacity:.4; }
  .sub { margin-top:-8px; }
  .field-input { padding:11px 14px; border-radius:var(--radius-sm); border:1.5px solid var(--border); background:var(--bg); color:var(--text); font-family:inherit; font-size:15px; width:100%; outline:none; }
  .field-input:focus { border-color:var(--primary); }
  .subject-list { display:flex; flex-direction:column; gap:8px; }
  .subject-row { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:var(--radius-sm); background:var(--bg3); cursor:pointer; font-size:15px; }
  .goal-num { text-align:center; }
  .slider { width:100%; accent-color:var(--primary); }
  .slider-ends { display:flex; justify-content:space-between; font-size:12px; color:var(--muted); }
  .score-list { display:flex; flex-direction:column; gap:8px; }
  .score-row { display:flex; align-items:center; gap:10px; }
  .score-input { width:72px; padding:8px 10px; border-radius:8px; border:1.5px solid var(--border); background:var(--bg); color:var(--text); font-family:inherit; font-size:15px; text-align:center; outline:none; }
  .score-input:focus { border-color:var(--primary); }
  .actions { display:flex; gap:10px; margin-top:8px; }
  .skip-btn { background:none; border:none; color:var(--muted); font-size:13px; cursor:pointer; font-family:inherit; text-align:center; }
</style>
