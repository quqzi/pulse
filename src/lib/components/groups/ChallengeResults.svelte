<script lang="ts">
  import { t } from '$lib/i18n';
  import type { ChallengeResult } from '$lib/groups';

  export let results: ChallengeResult[] = [];
</script>

<section class="results-card" aria-labelledby="challenge-results-title">
  <h2 id="challenge-results-title">{$t.groups.challengeResultsTitle}</h2>

  {#if results.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.groups.leaderboardEmpty}</p>
    </div>
  {:else}
    <div class="result-list">
      {#each results as result, index (`${result.userId}:${result.takenAt}`)}
        <div class="result-row">
          <span class="rank">{index + 1}</span>
          <span class="name">{result.name}</span>
          <span class="score">{$t.groups.scoreOf(result.score, result.total)}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .results-card { margin-top: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); overflow: hidden; }
  h2 { margin: 0; padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--text); font-size: 15px; }
  .result-list { display: flex; flex-direction: column; }
  .result-row { display: flex; align-items: center; gap: 10px; padding: 11px 14px; }
  .result-row + .result-row { border-top: 1px solid var(--border); }
  .rank { width: 20px; flex: 0 0 20px; color: var(--muted); font-weight: 700; }
  .name { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--text); font-size: 14px; font-weight: 500; }
  .score { color: var(--primary); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .empty-state { padding: 32px 16px; text-align: center; }
  .empty-title { margin: 0; color: var(--text); font-size: 15px; font-weight: 600; }
</style>
