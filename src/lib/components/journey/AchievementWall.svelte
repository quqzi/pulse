<script lang="ts">
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { sessions, streak, examSessions, flashcards, tasks, customGoals, getAuthContext } from '$lib/stores/data';
  import { computeAchievements, goalValue, type AchievementInput } from '$lib/achievements';
  import { customGoalsRepo } from '$lib/data/entities';
  import { newId } from '$lib/id';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Picker from '$lib/components/Picker.svelte';
  import type { CustomGoal, GoalMetric } from '$lib/types';

  const SEEN_KEY = 'pulse.achievementsSeen';
  const EMOJIS = ['🎯', '🔥', '⭐', '📚', '🏆', '⚡', '🧠', '✅', '⏱️', '💪', '🚀', '📈'];

  $: input = {
    sessionCount: $sessions.length,
    totalHours: $sessions.reduce((sum, s) => sum + s.durationSec / 3600, 0),
    streak: $streak,
    mockCount: $examSessions.length,
    bestMockAccuracy: $examSessions.reduce(
      (best, s) => Math.max(best, s.totalQuestions > 0 ? (s.totalCorrect / s.totalQuestions) * 100 : 0),
      0
    ),
    cardCount: $flashcards.length,
    tasksCompleted: $tasks.filter((tp) => !!tp.completedAt).length,
  } satisfies AchievementInput;

  $: achievements = computeAchievements(input);

  // User-defined goals share the badge look; progress is computed the same way.
  $: goalBadges = $customGoals.map((g) => {
    const value = goalValue(g.metric, input);
    return { goal: g, value: Math.floor(value), unlocked: value >= g.target, progress: Math.min(1, value / g.target) };
  });

  $: labels = $t.achievements as unknown as Record<string, string>;

  // Celebrate newly-unlocked badges (built-in + custom) once — seen ids live in
  // localStorage so a returning visit doesn't re-toast the whole wall.
  $: unlockables = [
    ...achievements.map((a) => ({ id: a.id, unlocked: a.unlocked, title: labels[`${a.id}Title`] })),
    ...goalBadges.map((b) => ({ id: `custom:${b.goal.id}`, unlocked: b.unlocked, title: b.goal.title })),
  ];
  $: if (browser && unlockables.length) {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
    const fresh = unlockables.filter((a) => a.unlocked && !seen.has(a.id));
    if (fresh.length > 0 && seen.size > 0) {
      for (const a of fresh) toast.success($t.achievements.unlockedToast(a.title));
    }
    const unlockedIds = unlockables.filter((a) => a.unlocked).map((a) => a.id);
    if (fresh.length > 0 || seen.size === 0) {
      localStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds.length ? unlockedIds : ['__none__']));
    }
  }

  // ── create-goal sheet ─────────────────────────────────────
  let goalOpen = false;
  let gTitle = '';
  let gIcon = EMOJIS[0];
  let gMetric = 'hours';
  let gTarget = 20;
  let saving = false;

  $: metricOptions = [
    { value: 'hours', label: $t.achievements.metricHours },
    { value: 'sessions', label: $t.achievements.metricSessions },
    { value: 'streak', label: $t.achievements.metricStreak },
    { value: 'cards', label: $t.achievements.metricCards },
    { value: 'tasks', label: $t.achievements.metricTasks },
    { value: 'mocks', label: $t.achievements.metricMocks },
    { value: 'mockAccuracy', label: $t.achievements.metricMockAccuracy },
  ];

  $: canCreate = gTitle.trim().length > 0 && gTarget > 0 && !saving;

  function openSheet() {
    gTitle = '';
    gIcon = EMOJIS[0];
    gMetric = 'hours';
    gTarget = 20;
    goalOpen = true;
  }

  async function createGoal() {
    if (!canCreate) return;
    saving = true;
    const { userId } = getAuthContext();
    const goal: CustomGoal = {
      id: newId(),
      userId,
      title: gTitle.trim(),
      icon: gIcon,
      metric: gMetric as GoalMetric,
      target: Math.round(gTarget),
      createdAt: new Date().toISOString(),
    };
    await customGoalsRepo.save(goal);
    saving = false;
    goalOpen = false;
  }

  async function deleteGoal(goal: CustomGoal) {
    await customGoalsRepo.remove(goal.id);
    toast.success(get(t).achievements.goalDeleted, {
      label: get(t).common.undo,
      fn: () => customGoalsRepo.save(goal),
    });
  }
</script>

<div class="wall stagger-children">
  {#each achievements as a (a.id)}
    <div class="badge" class:unlocked={a.unlocked} title={labels[`${a.id}Desc`]}>
      <span class="badge-icon">{a.icon}</span>
      <span class="badge-title">{labels[`${a.id}Title`]}</span>
      <span class="badge-desc">{labels[`${a.id}Desc`]}</span>
      {#if !a.unlocked}
        <div class="badge-bar" aria-hidden="true">
          <div class="badge-bar-fill" style="transform: scaleX({a.progress});"></div>
        </div>
      {/if}
    </div>
  {/each}

  {#each goalBadges as b (b.goal.id)}
    <div class="badge custom" class:unlocked={b.unlocked} title={b.goal.title}>
      <button class="badge-del" on:click={() => deleteGoal(b.goal)} aria-label={$t.achievements.deleteGoal}>✕</button>
      <span class="badge-icon">{b.goal.icon}</span>
      <span class="badge-title">{b.goal.title}</span>
      <span class="badge-desc">{b.value} / {b.goal.target}</span>
      {#if !b.unlocked}
        <div class="badge-bar" aria-hidden="true">
          <div class="badge-bar-fill" style="transform: scaleX({b.progress});"></div>
        </div>
      {/if}
    </div>
  {/each}

  <button class="badge add-tile" on:click={openSheet}>
    <span class="add-plus">+</span>
    <span class="add-label">{$t.achievements.addGoal}</span>
  </button>
</div>

<BottomSheet bind:open={goalOpen} label={$t.achievements.newGoalTitle} on:close={() => (goalOpen = false)}>
  <h2 class="sheet-title">{$t.achievements.newGoalTitle}</h2>

  <div class="field">
    <span class="field-label">{$t.achievements.goalTitleLabel}</span>
    <input
      class="text-input"
      bind:value={gTitle}
      placeholder={$t.achievements.goalTitlePlaceholder}
      aria-label={$t.achievements.goalTitleLabel}
    />
  </div>

  <div class="field">
    <span class="field-label">{$t.achievements.goalIconLabel}</span>
    <div class="emoji-row">
      {#each EMOJIS as e (e)}
        <button
          class="emoji"
          class:active={gIcon === e}
          on:click={() => (gIcon = e)}
          aria-label={e}
          aria-pressed={gIcon === e}>{e}</button
        >
      {/each}
    </div>
  </div>

  <div class="field">
    <span class="field-label">{$t.achievements.goalMetricLabel}</span>
    <Picker bind:value={gMetric} options={metricOptions} ariaLabel={$t.achievements.goalMetricLabel} />
  </div>

  <div class="field">
    <span class="field-label">{$t.achievements.goalTargetLabel}</span>
    <input
      class="text-input target-input"
      type="number"
      min="1"
      bind:value={gTarget}
      aria-label={$t.achievements.goalTargetLabel}
    />
  </div>

  <div class="preview">
    <span class="preview-icon">{gIcon}</span>
    <span class="preview-text">{gTitle.trim() || $t.achievements.goalTitlePlaceholder}</span>
    <span class="preview-target">0 / {gTarget}</span>
  </div>

  <button class="btn-create" disabled={!canCreate} on:click={createGoal}>{$t.achievements.createGoal}</button>
</BottomSheet>

<style>
  .wall {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .badge {
    position: relative;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 3px; padding: 14px 10px 12px;
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md);
  }
  .badge:not(.unlocked):not(.add-tile) { opacity: 0.55; }
  .badge:not(.unlocked) .badge-icon { filter: grayscale(1); }
  .badge.unlocked { border-color: color-mix(in srgb, var(--primary) 30%, transparent); }
  .badge.custom.unlocked { border-color: color-mix(in srgb, var(--primary) 45%, transparent); }
  .badge-icon { font-size: 26px; line-height: 1.2; }
  .badge-title { font-size: 12.5px; font-weight: 700; color: var(--text); }
  .badge-desc { font-size: 11px; color: var(--muted); line-height: 1.3; }
  .badge-bar {
    width: 100%; height: 3px; margin-top: 6px;
    background: var(--bg3); border-radius: 2px; overflow: hidden;
  }
  .badge-bar-fill {
    height: 100%; width: 100%; background: var(--primary);
    transform-origin: left; transition: transform var(--dur-slow) var(--ease-out);
  }
  .badge-del {
    position: absolute; top: 4px; right: 4px;
    width: 22px; height: 22px; border: none; border-radius: 6px;
    background: transparent; color: var(--muted); font-size: 12px; cursor: pointer;
    opacity: 0; transition: opacity 120ms ease, background 120ms ease, color 120ms ease;
  }
  .badge.custom:hover .badge-del, .badge-del:focus-visible { opacity: 1; }
  .badge-del:hover { background: var(--bg3); color: var(--danger); }

  .add-tile {
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    border-style: dashed;
    color: var(--muted);
    font-family: inherit;
    transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
  }
  .add-tile:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-l); }
  .add-plus { font-size: 24px; font-weight: 400; line-height: 1; }
  .add-label { font-size: 12px; font-weight: 600; }

  /* create sheet */
  .sheet-title { font-size: 17px; font-weight: 700; color: var(--text); margin: 0 0 14px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .field-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--muted);
  }
  .text-input {
    width: 100%; box-sizing: border-box;
    background: var(--bg); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; font-size: 14px; color: var(--text); font-family: inherit;
  }
  .text-input:focus { outline: none; border-color: var(--primary); }
  .target-input { width: 120px; font-weight: 600; }
  .emoji-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .emoji {
    width: 40px; height: 40px; border: 1.5px solid var(--border); border-radius: 10px;
    background: var(--bg); font-size: 20px; cursor: pointer; line-height: 1;
  }
  .emoji.active { border-color: var(--primary); background: var(--primary-l); }
  .preview {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; margin-bottom: 16px;
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md);
  }
  .preview-icon { font-size: 22px; line-height: 1; }
  .preview-text { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .preview-target { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .btn-create {
    width: 100%; padding: 12px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .btn-create:disabled { opacity: 0.4; cursor: not-allowed; }
  @media (max-width: 768px) { .emoji { min-width: 44px; min-height: 44px; } .btn-create { min-height: 44px; } }
</style>
