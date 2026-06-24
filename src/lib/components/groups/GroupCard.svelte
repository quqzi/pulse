<script lang="ts">
  import type { GroupSummary } from '$lib/groups';
  import { t } from '$lib/i18n';
  export let group: GroupSummary;
</script>

<a class="card group-card" href="/groups/{group.id}">
  <div class="g-title">
    {#if group.icon}<span class="g-icon" aria-hidden="true">{group.icon}</span>{/if}
    <div class="g-copy">
      <div class="g-name">{group.name}</div>
      {#if group.description}<div class="g-description">{group.description}</div>{/if}
    </div>
  </div>
  <div class="g-meta">
    <span>{group.memberCap == null ? $t.groups.members(group.memberCount) : $t.groups.membersCapped(group.memberCount, group.memberCap)}</span>
    {#if group.status === 'pending'}<span class="pend">{$t.groups.pendingState}</span>{/if}
    {#if group.isOwner && group.pendingCount > 0}<span class="badge">{$t.groups.pending(group.pendingCount)}</span>{/if}
  </div>
</a>

<style>
  .group-card { display: block; padding: 14px 16px; text-decoration: none; color: var(--text); }
  .g-title { display: flex; align-items: flex-start; gap: 9px; min-width: 0; }
  .g-icon { flex: 0 0 auto; line-height: 1.25; font-size: 17px; }
  .g-copy { min-width: 0; flex: 1; }
  .g-name { font-size: 15px; font-weight: 600; }
  .g-description { margin-top: 3px; color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .g-meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; font-size: 12px; color: var(--muted); }
  .badge { background: var(--primary); color: var(--bg); border-radius: 9999px; padding: 1px 8px; font-weight: 600; }
  .pend { color: var(--warning); }
</style>
