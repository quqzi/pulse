<script lang="ts">
  import { browser } from '$app/environment';
  import { sessions, streak, examSessions, flashcards, tasks } from '$lib/stores/data';
  import { computeAchievements } from '$lib/achievements';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';

  const SEEN_KEY = 'pulse.achievementsSeen';

  $: achievements = computeAchievements({
    sessionCount: $sessions.length,
    totalHours: $sessions.reduce((sum, s) => sum + s.durationSec / 3600, 0),
    streak: $streak,
    mockCount: $examSessions.length,
    bestMockAccuracy: $examSessions.reduce(
      (best, s) => Math.max(best, s.totalQuestions > 0 ? (s.totalCorrect / s.totalQuestions) * 100 : 0),
      0
    ),
    cardCount: $flashcards.length,
    tasksCompleted: $tasks.filter(tp => !!tp.completedAt).length,
  });

  $: labels = $t.achievements as unknown as Record<string, string>;

  // Celebrate newly-unlocked badges once — seen ids live in localStorage so a
  // returning visit doesn't re-toast the whole wall.
  $: if (browser && achievements.length) {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'));
    const fresh = achievements.filter(a => a.unlocked && !seen.has(a.id));
    if (fresh.length > 0 && seen.size > 0) {
      for (const a of fresh) toast.success($t.achievements.unlockedToast(labels[`${a.id}Title`]));
    }
    const unlockedIds = achievements.filter(a => a.unlocked).map(a => a.id);
    if (fresh.length > 0 || seen.size === 0) {
      localStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds.length ? unlockedIds : ['__none__']));
    }
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
</div>

<style>
  .wall {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }
  .badge {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    gap: 3px; padding: 14px 10px 12px;
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md);
  }
  .badge:not(.unlocked) { opacity: 0.55; }
  .badge:not(.unlocked) .badge-icon { filter: grayscale(1); }
  .badge.unlocked { border-color: color-mix(in srgb, var(--primary) 30%, transparent); }
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
</style>
