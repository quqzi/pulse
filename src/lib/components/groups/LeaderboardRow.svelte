<script lang="ts">
  import type { LeaderboardEntry } from '$lib/groups';
  import { t } from '$lib/i18n';
  import type { PresenceStatus } from '$lib/presence';

  export let entry: LeaderboardEntry;
  export let rank: number;
  export let status: PresenceStatus | undefined = undefined;
</script>

<div class="row">
  <span class="rank">{rank}</span>
  {#if status === 'studying' || status === 'exam'}
    <span
      class="status-dot"
      class:studying={status === 'studying'}
      class:exam={status === 'exam'}
      aria-label={status === 'studying' ? $t.groups.statusStudying : $t.groups.statusExam}
      title={status === 'studying' ? $t.groups.statusStudying : $t.groups.statusExam}
    ></span>
  {/if}
  <span class="name">{entry.displayName}</span>
  <span class="ach" aria-label={$t.groups.achievements}>
    {#each entry.achievements.slice(0, 3) as achievement (achievement.id)}
      <span aria-hidden="true">{achievement.icon}</span>
    {/each}
  </span>
  {#if entry.streak > 0}
    <span class="streak" title={$t.groups.streak}>🔥{entry.streak}</span>
  {/if}
  <span class="hrs" title={$t.groups.weeklyHours}>{entry.weeklyHours.toFixed(1)}h</span>
</div>

<style>
  .row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
  .rank { width: 20px; flex: 0 0 20px; font-weight: 700; color: var(--muted); }
  .status-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; }
  .status-dot.studying { background: var(--success); }
  .status-dot.exam { background: var(--warning); }
  .name { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 500; color: var(--text); }
  .ach { display: flex; gap: 2px; font-size: 13px; }
  .streak { white-space: nowrap; font-size: 12px; color: var(--muted); }
  .hrs { white-space: nowrap; font-size: 14px; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; }
</style>
