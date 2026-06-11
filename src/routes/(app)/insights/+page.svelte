<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { insights, loadData } from '$lib/stores/data';
  import { t } from '$lib/i18n';
  import InsightCard from '$lib/components/insights/InsightCard.svelte';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

<div class="insights-page">
  <header class="page-head">
    <h1 class="text-large-title page-title">{$t.insights.title}</h1>
    <p class="page-sub">{$t.insights.sub}</p>
  </header>

  {#if $insights.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.insights.emptyTitle}</p>
      <p class="empty-sub">{$t.insights.emptySub}</p>
      <a class="empty-action" href="/timer">{$t.insights.emptyAction} →</a>
    </div>
  {:else}
    <div class="feed">
      {#each $insights as insight (insight.id)}
        <InsightCard {insight} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .insights-page { padding: 20px 16px 80px; max-width: 720px; margin: 0 auto; }
  .page-head { margin-bottom: 20px; }
  .page-title { margin: 0; color: var(--text); }
  .page-sub { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
  .feed { display: flex; flex-direction: column; gap: 10px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
  .empty-action { display: inline-block; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none; }
  .empty-action:hover { text-decoration: underline; }
</style>
