<script lang="ts">
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { settings } from '$lib/stores/settings';
  import { auth } from '$lib/stores/auth';
  import { BUILTIN_TEMPLATES } from '$lib/constants';
  import { db } from '$lib/db';
  import type { Subject, Template } from '$lib/types';

  let step = 0;
  let examDate = '';
  let pickedTemplate: Template | null = null;
  let checked: Set<string> = new Set();
  let dailyGoalHours = 4;
  let targetScores: Record<string, number> = {};
  let saveError = '';
  const TOTAL = 4;

  $: checked = new Set((pickedTemplate?.presets ?? []).map(p => p.name));
  $: isAuthenticated = $auth.mode === 'authenticated';
  $: selectedPresets = pickedTemplate?.presets.filter(p => checked.has(p.name)) ?? [];
  $: nextDisabled = step === 1 && (pickedTemplate === null || selectedPresets.length === 0);

  function togglePreset(name: string) {
    const next = new Set(checked);
    if (next.has(name)) next.delete(name); else next.add(name);
    checked = next;
  }

  function next() { step < TOTAL ? step++ : finish(); }

  async function finish() {
    saveError = '';
    settings.update(s => ({ ...s, dailyGoalHours }));
    localStorage.setItem('pulse_exam_date', examDate);
    localStorage.setItem('pulse_target_scores', JSON.stringify(targetScores));
    localStorage.setItem('pulse_onboarded', '1');

    const authState = get(auth);
    const isAuth = authState.mode === 'authenticated';
    const userId = isAuth ? (authState.user?.id ?? 'guest') : 'guest';
    const mode: 'guest' | 'authenticated' = isAuth ? 'authenticated' : 'guest';

    const subjectRecords: Subject[] = selectedPresets.map((p, i) => ({
      id: db.newId(),
      userId,
      name: p.name,
      symbol: p.symbol,
      color: p.color,
      colorRgb: p.colorRgb,
      orderIndex: i,
      targetScore: targetScores[p.name],
    }));

    if (mode === 'guest') {
      localStorage.setItem('pulse_subjects', JSON.stringify(subjectRecords));
    } else {
      try {
        await Promise.all(subjectRecords.map(s => db.saveSubject(s, 'authenticated')));
      } catch {
        saveError = 'Failed to save your subjects. Please try again.';
        return;
      }
    }

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
      <h2 class="text-heading">When is your exam?</h2>
      <p class="text-body text-muted sub">We'll show a countdown and pace your study plan.</p>
      <input type="date" bind:value={examDate} class="field-input" />

    {:else if step === 1}
      {#if !pickedTemplate}
        <h2 class="text-heading">What are you studying?</h2>
        <p class="text-body text-muted sub">Pick a template to get started.</p>
        <div class="template-list">
          {#each BUILTIN_TEMPLATES as t}
            <button class="template-card" on:click={() => pickedTemplate = t}>
              <div class="tpl-info">
                <span class="tpl-name">{t.name}</span>
                <span class="tpl-count">{t.presets.length} subjects</span>
              </div>
              <div class="tpl-dots">
                {#each t.presets.slice(0, 5) as p}
                  <span class="color-dot" style="background:{p.color}"></span>
                {/each}
                {#if t.presets.length > 5}
                  <span class="dot-more">+{t.presets.length - 5}</span>
                {/if}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          {/each}
        </div>
      {:else}
        <div class="checklist-header">
          <button class="back-link" on:click={() => pickedTemplate = null}>← Change template</button>
          <h2 class="text-heading">{pickedTemplate.name}</h2>
        </div>
        <p class="text-body text-muted sub">Uncheck any subjects you don't need.</p>
        <div class="preset-list">
          {#each pickedTemplate.presets as preset}
            <label class="preset-row">
              <input type="checkbox" checked={checked.has(preset.name)} on:change={() => togglePreset(preset.name)} />
              <span class="preset-symbol" style="color:{preset.color}">{preset.symbol}</span>
              <span>{preset.name}</span>
            </label>
          {/each}
        </div>
      {/if}

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
        {#each selectedPresets as preset}
          <div class="score-row">
            <span class="text-body" style="flex:1">{preset.name}</span>
            <input type="number" min="0" max="100" placeholder="—" bind:value={targetScores[preset.name]} class="score-input" />
          </div>
        {/each}
      </div>

    {:else}
      <h2 class="text-heading">You're all set!</h2>
      <p class="text-body text-muted sub">Your study tracker is ready. Let's go.</p>
    {/if}

    {#if saveError}
      <p class="save-error">{saveError}</p>
    {/if}

    <div class="actions">
      {#if step > 0}<button class="btn btn-secondary" on:click={() => step--}>Back</button>{/if}
      <button class="btn btn-primary" style="flex:1" on:click={next} disabled={nextDisabled}>
        {step === TOTAL ? 'Get started' : 'Next'}
      </button>
    </div>

    {#if step === 0 && !isAuthenticated}
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

  /* template picker */
  .template-list { display:flex; flex-direction:column; gap:8px; }
  .template-card {
    display:flex; align-items:center; gap:12px; padding:14px 16px; width:100%; text-align:left;
    background:var(--bg3); border:1.5px solid var(--border); border-radius:var(--radius-md);
    cursor:pointer; transition:border-color 120ms ease;
  }
  .template-card:hover { border-color:var(--primary); }
  .tpl-info { flex:1; }
  .tpl-name { display:block; font-size:15px; font-weight:600; color:var(--text); }
  .tpl-count { font-size:12px; color:var(--muted); }
  .tpl-dots { display:flex; align-items:center; gap:4px; }
  .color-dot { width:8px; height:8px; border-radius:50%; }
  .dot-more { font-size:11px; color:var(--muted); }

  /* checklist */
  .checklist-header { display:flex; flex-direction:column; gap:4px; }
  .back-link { background:none; border:none; cursor:pointer; color:var(--primary); font-size:13px; font-family:inherit; text-align:left; padding:0; }
  .preset-list { display:flex; flex-direction:column; gap:6px; }
  .preset-row { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:var(--radius-md); background:var(--bg3); cursor:pointer; font-size:15px; }
  .preset-symbol { font-weight:700; width:28px; flex-shrink:0; }

  /* daily goal */
  .goal-num { text-align:center; }
  .slider { width:100%; accent-color:var(--primary); }
  .slider-ends { display:flex; justify-content:space-between; font-size:12px; color:var(--muted); }

  /* target scores */
  .score-list { display:flex; flex-direction:column; gap:8px; }
  .score-row { display:flex; align-items:center; gap:10px; }
  .score-input { width:72px; padding:8px 10px; border-radius:var(--radius-md); border:1.5px solid var(--border); background:var(--bg); color:var(--text); font-family:inherit; font-size:15px; text-align:center; outline:none; }
  .score-input:focus { border-color:var(--primary); }

  .actions { display:flex; gap:10px; margin-top:8px; }
  .skip-btn { background:none; border:none; color:var(--muted); font-size:13px; cursor:pointer; font-family:inherit; text-align:center; }
  .save-error { color: var(--danger); font-size: 13px; text-align: center; }
</style>
