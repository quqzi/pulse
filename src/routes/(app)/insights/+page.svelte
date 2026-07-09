<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { insights, loadData } from '$lib/stores/data';
  import { t } from '$lib/i18n';
  import InsightCard from '$lib/components/insights/InsightCard.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);
</script>

<div class="insights-page">
  <header class="page-head">
    <h1 class="text-large-title page-title">{$t.insights.title}</h1>
    <p class="page-sub">{$t.insights.sub}</p>
  </header>

  {#if $insights.length === 0}
    <EmptyState icon="sparkle" title={$t.insights.emptyTitle} sub={$t.insights.emptySub}>
      <a class="empty-action" href="/timer">{$t.insights.emptyAction} →</a>
    </EmptyState>
  {:else}
    <div class="feed stagger-children">
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

  @media (min-width: 1024px) {
    .insights-page { max-width: 1040px; }
    .feed { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: start; }
  }
</style>
