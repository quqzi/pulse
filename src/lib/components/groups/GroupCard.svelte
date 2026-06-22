<script lang="ts">
  import type { GroupSummary } from '$lib/groups';
  import { t } from '$lib/i18n';
  export let group: GroupSummary;
</script>

<a class="card group-card" href="/groups/{group.id}">
  <div class="g-name">{group.name}</div>
  <div class="g-meta">
    <span>{$t.groups.members(group.memberCount)}</span>
    {#if group.status === 'pending'}<span class="pend">{$t.groups.pendingState}</span>{/if}
    {#if group.isOwner && group.pendingCount > 0}<span class="badge">{$t.groups.pending(group.pendingCount)}</span>{/if}
  </div>
</a>

<style>
  .group-card { display: block; padding: 14px 16px; text-decoration: none; color: var(--text); }
  .g-name { font-size: 15px; font-weight: 600; }
  .g-meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; font-size: 12px; color: var(--muted); }
  .badge { background: var(--primary); color: var(--bg); border-radius: 9999px; padding: 1px 8px; font-weight: 600; }
  .pend { color: var(--warning); }
</style>
