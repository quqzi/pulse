<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Insight } from '$lib/insights';

  export let insight: Insight;

  // i18n values are either plain strings or interpolation functions of varying arity.
  const resolve = (v: unknown, args: (string | number)[] = []): string =>
    typeof v === 'function' ? (v as (...a: unknown[]) => string)(...args) : (v as string);

  $: title = resolve($t.insights[insight.titleKey], insight.titleArgs);
  $: body = insight.bodyKey ? resolve($t.insights[insight.bodyKey], insight.bodyArgs) : '';
  $: actionLabel = insight.action ? resolve($t.insights[insight.action.labelKey]) : '';
</script>

<div class="insight-card sev-{insight.severity}">
  <span class="insight-icon" aria-hidden="true">{insight.icon}</span>
  <div class="insight-body">
    <p class="insight-title">{title}</p>
    {#if body}<p class="insight-sub">{body}</p>{/if}
    {#if insight.action}
      <a class="insight-action" href={insight.action.href}>{actionLabel} →</a>
    {/if}
  </div>
</div>

<style>
  .insight-card {
    display: flex; gap: 12px; align-items: flex-start;
    background: var(--bg2); border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: var(--radius-md); padding: 14px 16px;
  }
  .sev-high { border-left-color: var(--danger); }
  .sev-medium { border-left-color: var(--primary); }
  .sev-positive { border-left-color: var(--success); }
  .insight-icon { font-size: 18px; line-height: 1.4; flex-shrink: 0; }
  .insight-body { flex: 1; min-width: 0; }
  .insight-title { font-size: 14px; font-weight: 600; color: var(--text); margin: 0; }
  .insight-sub { font-size: 13px; color: var(--muted); margin: 2px 0 0; line-height: 1.4; }
  .insight-action {
    display: inline-block; margin-top: 8px;
    font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none;
  }
  .insight-action:hover { text-decoration: underline; }
</style>
