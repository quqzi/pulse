<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import LeaderboardRow from '$lib/components/groups/LeaderboardRow.svelte';
  import ShareItemCard from '$lib/components/groups/ShareItemCard.svelte';
  import SharePickerSheet from '$lib/components/groups/SharePickerSheet.svelte';
  import {
    approveMember,
    deleteGroup,
    getLeaderboard,
    leaveGroup,
    listPending,
    listShares,
    loadMyGroups,
    myGroups,
    removeMember,
    renameGroup,
    setVisibility,
    type LeaderboardEntry,
    type GroupShare,
    type PendingRequest,
  } from '$lib/groups';
  import { t } from '$lib/i18n';
  import { auth } from '$lib/stores/auth';

  type Tab = 'leaderboard' | 'shared' | 'manage';

  let board: LeaderboardEntry[] = [];
  let pending: PendingRequest[] = [];
  let shares: GroupShare[] = [];
  let tab: Tab = 'leaderboard';
  let sharePickerOpen = false;
  let renameName = '';
  let confirmAction: 'delete' | 'leave' | null = null;
  let busy = false;
  let mounted = false;
  let ready = false;
  let loadedFor = '';

  $: gid = $page.params.id ?? '';
  $: group = $myGroups.find(candidate => candidate.id === gid);

  async function refresh() {
    if ($auth.mode !== 'authenticated') return;
    const current = $myGroups.find(candidate => candidate.id === gid);
    if (current?.status !== 'approved') {
      board = [];
      pending = [];
      return;
    }
    board = await getLeaderboard(gid);
    pending = current.isOwner ? await listPending(gid) : [];
  }

  async function refreshShares() {
    if ($auth.mode !== 'authenticated' || group?.status !== 'approved') {
      shares = [];
      return;
    }
    shares = await listShares(gid);
  }

  async function changeTab(nextTab: Tab) {
    tab = nextTab;
    if (nextTab === 'shared') await refreshShares();
  }

  function sharerName(share: GroupShare): string {
    if (share.sharedBy === $auth.user?.id) return $t.groups.you;
    return board.find(entry => entry.userId === share.sharedBy)?.displayName ?? $t.groups.groupMember;
  }

  async function initialize() {
    if ($auth.mode !== 'authenticated') return;
    const loadKey = `${$auth.user?.id ?? ''}:${gid}`;
    if (loadedFor === loadKey) return;
    loadedFor = loadKey;
    ready = false;
    shares = [];
    sharePickerOpen = false;
    if ($myGroups.length === 0) await loadMyGroups();
    const current = $myGroups.find(candidate => candidate.id === gid);
    renameName = current?.name ?? '';
    await refresh();
    if (tab === 'shared') await refreshShares();
    ready = true;
  }

  async function mutate(action: () => Promise<void>) {
    if ($auth.mode !== 'authenticated' || busy) return;
    busy = true;
    try {
      await action();
      await loadMyGroups();
      await refresh();
    } finally {
      busy = false;
    }
  }

  async function saveName() {
    const nextName = renameName.trim();
    if (!nextName || nextName === group?.name) return;
    await mutate(() => renameGroup(gid, nextName));
    renameName = $myGroups.find(candidate => candidate.id === gid)?.name ?? nextName;
  }

  function changeVisibility(event: Event) {
    const visible = (event.currentTarget as HTMLInputElement).checked;
    void mutate(() => setVisibility(gid, visible));
  }

  async function confirmDelete() {
    if ($auth.mode !== 'authenticated' || busy) return;
    busy = true;
    try {
      await deleteGroup(gid);
      await loadMyGroups();
      await goto('/groups');
    } finally {
      busy = false;
    }
  }

  async function confirmLeave() {
    if ($auth.mode !== 'authenticated' || busy) return;
    busy = true;
    try {
      await leaveGroup(gid);
      await loadMyGroups();
      await goto('/groups');
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    mounted = true;
    void initialize();
  });

  $: if (mounted) {
    if ($auth.mode === 'authenticated') {
      void initialize();
    } else {
      loadedFor = '';
      ready = false;
      board = [];
      pending = [];
      shares = [];
      sharePickerOpen = false;
    }
  }
</script>

<div class="page">
  {#if $auth.mode !== 'authenticated'}
    <h1 class="text-large-title">{$t.groups.title}</h1>
    <div class="empty-state"><p class="empty-title">{$t.groups.signInPrompt}</p></div>
  {:else if ready && !group}
    <h1 class="text-large-title">{$t.groups.title}</h1>
    <div class="empty-state"><p class="empty-title">{$t.groups.groupNotFound}</p></div>
  {:else if group}
    <header class="header">
      <div>
        <h1 class="text-large-title">{group.name}</h1>
        <p class="member-count">{$t.groups.members(group.memberCount)}</p>
      </div>
      {#if group.isOwner && group.inviteCode}
        <div class="invite">
          <span>{$t.groups.inviteCode}</span>
          <code>{group.inviteCode}</code>
        </div>
      {/if}
    </header>

    <div class="tabs" role="tablist" aria-label={$t.groups.title}>
      <button id="tab-leaderboard" type="button" role="tab" aria-selected={tab === 'leaderboard'} aria-controls="panel-leaderboard" class:active={tab === 'leaderboard'} on:click={() => changeTab('leaderboard')}>{$t.groups.leaderboard}</button>
      <button id="tab-shared" type="button" role="tab" aria-selected={tab === 'shared'} aria-controls="panel-shared" class:active={tab === 'shared'} on:click={() => changeTab('shared')}>{$t.groups.shared}</button>
      <button id="tab-manage" type="button" role="tab" aria-selected={tab === 'manage'} aria-controls="panel-manage" class:active={tab === 'manage'} on:click={() => changeTab('manage')}>{$t.groups.manage}</button>
    </div>

    {#if tab === 'leaderboard'}
      <div id="panel-leaderboard" role="tabpanel" aria-labelledby="tab-leaderboard" class="panel board-panel">
        {#if group.status === 'pending'}
          <div class="empty-state"><p class="empty-title">{$t.groups.pendingState}</p></div>
        {:else if board.length === 0}
          <div class="empty-state"><p class="empty-title">{$t.groups.leaderboardEmpty}</p></div>
        {:else}
          {#each board as entry, index (entry.userId)}
            <LeaderboardRow {entry} rank={index + 1} />
          {/each}
        {/if}
      </div>
    {:else if tab === 'shared'}
      <div id="panel-shared" role="tabpanel" aria-labelledby="tab-shared" class="shared-panel">
        {#if group.status === 'pending'}
          <div class="panel empty-state"><p class="empty-title">{$t.groups.pendingState}</p></div>
        {:else}
          <div class="shared-toolbar">
            <div>
              <h2>{$t.groups.shared}</h2>
              <p>{$t.groups.sharedSub}</p>
            </div>
            <button type="button" class="action primary share-button" on:click={() => (sharePickerOpen = true)}>{$t.groups.share}</button>
          </div>
          {#if shares.length === 0}
            <div class="panel empty-state">
              <p class="empty-title">{$t.groups.sharedEmpty}</p>
              <p class="empty-sub">{$t.groups.sharedEmptySub}</p>
            </div>
          {:else}
            <div class="panel share-list">
              {#each shares as share (share.id)}
                <ShareItemCard
                  {share}
                  sharer={sharerName(share)}
                  canDelete={group.isOwner || share.sharedBy === $auth.user?.id}
                  on:refresh={refreshShares}
                />
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {:else}
      <div id="panel-manage" role="tabpanel" aria-labelledby="tab-manage" class="manage-stack">
        <div class="panel setting-row">
          <label for="group-visibility">{group.visible ? $t.groups.visibleOn : $t.groups.visibleOff}</label>
          <input id="group-visibility" type="checkbox" checked={group.visible} disabled={busy} on:change={changeVisibility} />
        </div>

        {#if group.isOwner}
          <div class="panel owner-section">
            <h2>{$t.groups.pendingRequests}</h2>
            {#if pending.length === 0}
              <p class="muted">{$t.groups.pendingEmpty}</p>
            {:else}
              <div class="request-list">
                {#each pending as request (request.userId)}
                  <div class="request-row">
                    <span>{request.displayName}</span>
                    <div class="request-actions">
                      <button type="button" class="action primary" disabled={busy} on:click={() => mutate(() => approveMember(gid, request.userId))}>{$t.groups.approve}</button>
                      <button type="button" class="action" disabled={busy} on:click={() => mutate(() => removeMember(gid, request.userId))}>{$t.groups.remove}</button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <form class="panel rename-form" on:submit|preventDefault={saveName}>
            <label for="group-name">{$t.groups.rename}</label>
            <div class="rename-actions">
              <input id="group-name" bind:value={renameName} maxlength="60" disabled={busy} />
              <button type="submit" class="action primary" disabled={busy || !renameName.trim() || renameName.trim() === group.name}>{$t.common.save}</button>
            </div>
          </form>

          <div class="panel danger-zone">
            {#if confirmAction === 'delete'}
              <div class="inline-confirm" role="alert">
                <div><strong>{$t.groups.deleteConfirm}</strong><span>{$t.common.cannotUndo}</span></div>
                <div class="confirm-actions">
                  <button type="button" class="action" disabled={busy} on:click={() => (confirmAction = null)}>{$t.common.cancel}</button>
                  <button type="button" class="action danger" disabled={busy} on:click={confirmDelete}>{$t.groups.delete}</button>
                </div>
              </div>
            {:else}
              <button type="button" class="action danger" disabled={busy} on:click={() => (confirmAction = 'delete')}>{$t.groups.delete}</button>
            {/if}
          </div>
        {:else}
          <div class="panel danger-zone">
            {#if confirmAction === 'leave'}
              <div class="inline-confirm" role="alert">
                <strong>{$t.groups.leaveConfirm}</strong>
                <div class="confirm-actions">
                  <button type="button" class="action" disabled={busy} on:click={() => (confirmAction = null)}>{$t.common.cancel}</button>
                  <button type="button" class="action danger" disabled={busy} on:click={confirmLeave}>{$t.groups.leave}</button>
                </div>
              </div>
            {:else}
              <button type="button" class="action danger" disabled={busy} on:click={() => (confirmAction = 'leave')}>{$t.groups.leave}</button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<SharePickerSheet
  bind:open={sharePickerOpen}
  {gid}
  on:close={() => (sharePickerOpen = false)}
  on:refresh={refreshShares}
/>

<style>
  .page { max-width: 720px; margin: 0 auto; padding: 20px 16px 80px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .header h1 { margin-bottom: 2px; overflow-wrap: anywhere; }
  .member-count, .muted { margin: 0; color: var(--muted); font-size: 13px; }
  .invite { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: var(--muted); font-size: 12px; }
  .invite code { color: var(--text); font-family: var(--font-mono); font-size: 15px; font-weight: 700; letter-spacing: 1px; }
  .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 20px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); }
  .tabs button { min-width: 0; padding: 9px 6px; border: 0; border-radius: calc(var(--radius-md) - 4px); background: transparent; color: var(--muted); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .tabs button.active { background: var(--primary); color: var(--bg); }
  .panel { margin-top: 12px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); }
  .board-panel { overflow: hidden; }
  .board-panel :global(.row + .row) { border-top: 1px solid var(--border); }
  .empty-state { padding: 32px 16px; text-align: center; }
  .empty-title { margin: 0; color: var(--text); font-size: 15px; font-weight: 600; }
  .empty-sub { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
  .shared-panel { margin-top: 12px; }
  .shared-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
  .shared-toolbar h2 { margin: 0; color: var(--text); font-size: 15px; }
  .shared-toolbar p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
  .share-button { flex: 0 0 auto; }
  .share-list { overflow: hidden; }
  .share-list :global(.share-card + .share-card) { border-top: 1px solid var(--border); }
  .manage-stack { display: flex; flex-direction: column; }
  .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; color: var(--text); font-size: 14px; font-weight: 500; }
  .setting-row input { width: 20px; height: 20px; accent-color: var(--primary); }
  .owner-section, .rename-form, .danger-zone { padding: 16px; }
  .owner-section h2 { margin: 0 0 12px; color: var(--text); font-size: 15px; }
  .request-list { display: flex; flex-direction: column; gap: 10px; }
  .request-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text); font-size: 14px; }
  .request-row > span { min-width: 0; overflow-wrap: anywhere; }
  .request-actions, .rename-actions, .confirm-actions { display: flex; align-items: center; gap: 8px; }
  .rename-form label { display: block; margin-bottom: 8px; color: var(--text); font-size: 14px; font-weight: 600; }
  .rename-actions input { flex: 1; min-width: 0; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; }
  .action { min-height: 36px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .action.primary { border-color: var(--primary); background: var(--primary); color: var(--bg); }
  .action.danger { border-color: var(--danger); background: var(--danger-soft); color: var(--text); }
  .action:disabled { cursor: default; opacity: 0.55; }
  .inline-confirm { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text); font-size: 14px; }
  .inline-confirm div:first-child { display: flex; flex-direction: column; gap: 2px; }
  .inline-confirm span { color: var(--muted); font-size: 12px; }

  @media (max-width: 520px) {
    .header { flex-direction: column; }
    .invite { align-items: flex-start; }
    .request-row, .inline-confirm { align-items: flex-start; flex-direction: column; }
    .request-actions, .confirm-actions { width: 100%; }
    .request-actions .action, .confirm-actions .action { flex: 1; }
  }
</style>
