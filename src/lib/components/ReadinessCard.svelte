<script lang="ts">
  import { goto } from '$app/navigation';
  import { readinessScore, subjects } from '$lib/stores/data';
  import { t } from '$lib/i18n';
</script>

<div class="card">
  <div class="card-header">
    <span class="card-label">{$t.readiness.title}</span>
  </div>

  <div class="score-big">{$readinessScore.overall}<span class="score-pct">%</span></div>

  <div class="pills">
    {#each $subjects as subj (subj.id)}
      {@const score = $readinessScore.bySubject[subj.id] ?? 0}
      <div class="pill">
        <span class="pill-name">{subj.name}</span>
        <span class="pill-score" style="color:{subj.color}">{score}%</span>
      </div>
    {/each}
    {#if $subjects.length === 0}
      <span class="no-data">{$t.readiness.noData}</span>
    {/if}
  </div>

  <button class="start-btn" on:click={() => goto('/exam')}>{$t.readiness.startExam}</button>
</div>

<style>
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .score-big { font-size: 52px; font-weight: 700; color: var(--primary); line-height: 1; }
  .score-pct { font-size: 22px; font-weight: 400; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; font-size: 11px; display: flex; gap: 6px; align-items: center; }
  .pill-name { color: var(--muted); }
  .pill-score { font-weight: 600; }
  .no-data { font-size: 12px; color: var(--muted); }
  .start-btn { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; align-self: flex-start; }
  @media (max-width: 768px) { .start-btn { min-height: 44px; } }
</style>
