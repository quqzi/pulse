<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import ChallengeCard from '$lib/components/groups/ChallengeCard.svelte';
  import ChallengePickerSheet from '$lib/components/groups/ChallengePickerSheet.svelte';
  import ChallengeResults from '$lib/components/groups/ChallengeResults.svelte';
  import ChallengeRunner from '$lib/components/groups/ChallengeRunner.svelte';
  import LeaderboardRow from '$lib/components/groups/LeaderboardRow.svelte';
  import ShareItemCard from '$lib/components/groups/ShareItemCard.svelte';
  import SharePickerSheet from '$lib/components/groups/SharePickerSheet.svelte';
  import {
    approveMember,
    deleteGroup,
    getChallengeQuestions,
    getChallengeResults,
    getLeaderboard,
    leaveGroup,
    listChallenges,
    listPending,
    listShares,
    loadMyGroups,
    myGroups,
    removeMember,
    setVisibility,
    submitChallengeResult,
    updateGroupSettings,
    type ChallengeQuestion,
    type ChallengeResult,
    type GroupChallenge,
    type LeaderboardEntry,
    type GroupSummary,
    type GroupShare,
    type PendingRequest,
  } from '$lib/groups';
  import { t } from '$lib/i18n';
  import { groupPresence } from '$lib/presence';
  import { auth } from '$lib/stores/auth';
  import { getAuthContext } from '$lib/stores/data';

  type Tab = 'leaderboard' | 'shared' | 'challenges' | 'manage';
  type JoinPolicy = 'approval' | 'open';
  type SharePolicy = 'members' | 'owner';

  const iconOptions = ['📚', '✏️', '🎯', '🔥', '🧠', '⭐', '🌟', '💡', '🧪', '📊', '🎓', '⚡'];

  let board: LeaderboardEntry[] = [];
  let pending: PendingRequest[] = [];
  let shares: GroupShare[] = [];
  let challenges: GroupChallenge[] = [];
  let tab: Tab = 'leaderboard';
  let sharePickerOpen = false;
  let challengePickerOpen = false;
  let activeChallenge: GroupChallenge | null = null;
  let activeQuestions: ChallengeQuestion[] = [];
  let challengeResults: ChallengeResult[] = [];
  let resultsForId = '';
  let settingsName = '';
  let settingsDescription = '';
  let settingsIcon: string | null = null;
  let settingsJoinPolicy: JoinPolicy = 'approval';
  let settingsSharePolicy: SharePolicy = 'members';
  let settingsMemberCap = '';
  let confirmAction: 'delete' | 'leave' | null = null;
  let busy = false;
  let mounted = false;
  let ready = false;
  let loadedFor = '';

  $: gid = $page.params.id ?? '';
  $: group = $myGroups.find(candidate => candidate.id === gid);
  $: presenceMap = $groupPresence[gid] ?? {};
  $: currentUserId = $auth.mode === 'authenticated' ? getAuthContext().userId : '';
  $: parsedMemberCap = parseMemberCap(settingsMemberCap);
  $: settingsChanged = !!group && (
    settingsName.trim() !== group.name ||
    settingsDescription.trim() !== (group.description ?? '').trim() ||
    (settingsIcon || null) !== group.icon ||
    settingsJoinPolicy !== group.joinPolicy ||
    settingsSharePolicy !== group.sharePolicy ||
    parsedMemberCap !== group.memberCap
  );

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

  async function refreshChallenges() {
    if ($auth.mode !== 'authenticated' || group?.status !== 'approved') {
      challenges = [];
      return;
    }
    challenges = await listChallenges(gid);
  }

  async function changeTab(nextTab: Tab) {
    tab = nextTab;
    if (nextTab === 'shared') await refreshShares();
    if (nextTab === 'challenges') await refreshChallenges();
  }

  function sharerName(share: GroupShare): string {
    if (share.sharedBy === $auth.user?.id) return $t.groups.you;
    return board.find(entry => entry.userId === share.sharedBy)?.displayName ?? $t.groups.groupMember;
  }

  function challengeSharerName(challenge: GroupChallenge): string {
    if (challenge.createdBy === $auth.user?.id) return $t.groups.you;
    return board.find(entry => entry.userId === challenge.createdBy)?.displayName ?? $t.groups.groupMember;
  }

  async function takeChallenge(challenge: GroupChallenge) {
    if (busy) return;
    busy = true;
    try {
      const fetched = await getChallengeQuestions(challenge.id);
      if (!fetched) return;
      activeQuestions = fetched.questions;
      activeChallenge = challenge;
      resultsForId = '';
      challengeResults = [];
    } finally {
      busy = false;
    }
  }

  async function showChallengeResults(challenge: GroupChallenge) {
    if (busy) return;
    busy = true;
    try {
      resultsForId = challenge.id;
      challengeResults = await getChallengeResults(challenge.id);
    } finally {
      busy = false;
    }
  }

  async function finishChallenge(event: CustomEvent<{ answers: number[] }>) {
    if (!activeChallenge || busy) return;
    const challengeId = activeChallenge.id;
    busy = true;
    try {
      const result = await submitChallengeResult(challengeId, event.detail.answers);
      if (result) {
        resultsForId = challengeId;
        challengeResults = await getChallengeResults(challengeId);
        activeChallenge = null;
      }
    } finally {
      busy = false;
    }
  }

  function seedSettings(current: GroupSummary | undefined) {
    settingsName = current?.name ?? '';
    settingsDescription = current?.description ?? '';
    settingsIcon = current?.icon ?? null;
    settingsJoinPolicy = current?.joinPolicy ?? 'approval';
    settingsSharePolicy = current?.sharePolicy ?? 'members';
    settingsMemberCap = current?.memberCap == null ? '' : String(current.memberCap);
  }

  function parseMemberCap(value: string): number | null {
    const nextValue = value.trim();
    if (!nextValue) return null;
    const parsed = Number.parseInt(nextValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  async function initialize() {
    if ($auth.mode !== 'authenticated') return;
    const loadKey = `${$auth.user?.id ?? ''}:${gid}`;
    if (loadedFor === loadKey) return;
    loadedFor = loadKey;
    ready = false;
    shares = [];
    challenges = [];
    activeChallenge = null;
    challengeResults = [];
    resultsForId = '';
    sharePickerOpen = false;
    challengePickerOpen = false;
    if ($myGroups.length === 0) await loadMyGroups();
    const current = $myGroups.find(candidate => candidate.id === gid);
    seedSettings(current);
    await refresh();
    if (tab === 'shared') await refreshShares();
    if (tab === 'challenges') await refreshChallenges();
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

  async function saveSettings() {
    const nextName = settingsName.trim();
    if (!nextName || !settingsChanged) return;
    await mutate(() => updateGroupSettings(gid, {
      name: nextName,
      description: settingsDescription.trim() || null,
      icon: settingsIcon || null,
      joinPolicy: settingsJoinPolicy,
      sharePolicy: settingsSharePolicy,
      memberCap: parsedMemberCap,
    }));
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
      challenges = [];
      activeChallenge = null;
      challengeResults = [];
      resultsForId = '';
      sharePickerOpen = false;
      challengePickerOpen = false;
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
        <h1 class="text-large-title group-title">
          {#if group.icon}<span class="group-icon" aria-hidden="true">{group.icon}</span>{/if}
          <span>{group.name}</span>
        </h1>
        <p class="member-count">
          {group.memberCap == null ? $t.groups.members(group.memberCount) : $t.groups.membersCapped(group.memberCount, group.memberCap)}
        </p>
        {#if group.description}<p class="group-description">{group.description}</p>{/if}
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
      <button id="tab-challenges" type="button" role="tab" aria-selected={tab === 'challenges'} aria-controls="panel-challenges" class:active={tab === 'challenges'} on:click={() => changeTab('challenges')}>{$t.groups.challenges}</button>
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
            <LeaderboardRow
              {entry}
              rank={index + 1}
              status={entry.userId === currentUserId ? undefined : presenceMap[entry.userId]}
            />
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
    {:else if tab === 'challenges'}
      <div id="panel-challenges" role="tabpanel" aria-labelledby="tab-challenges" class="challenges-panel">
        {#if group.status === 'pending'}
          <div class="panel empty-state"><p class="empty-title">{$t.groups.pendingState}</p></div>
        {:else if activeChallenge}
          <ChallengeRunner
            challengeId={activeChallenge.id}
            title={activeChallenge.title}
            questions={activeQuestions}
            on:done={finishChallenge}
            on:cancel={() => (activeChallenge = null)}
          />
        {:else if resultsForId}
          <div class="results-actions">
            <button type="button" class="action" disabled={busy} on:click={() => { resultsForId = ''; challengeResults = []; }}>
              {$t.groups.back}
            </button>
          </div>
          <ChallengeResults results={challengeResults} />
        {:else}
          <div class="challenge-toolbar">
            <div>
              <h2>{$t.groups.challenges}</h2>
              <p>{$t.groups.challengeEmptySub}</p>
            </div>
            <button type="button" class="action primary challenge-button" on:click={() => (challengePickerOpen = true)}>{$t.groups.newChallenge}</button>
          </div>
          {#if challenges.length === 0}
            <div class="panel empty-state">
              <p class="empty-title">{$t.groups.challengeEmpty}</p>
              <p class="empty-sub">{$t.groups.challengeEmptySub}</p>
            </div>
          {:else}
            <div class="panel challenge-list">
              {#each challenges as challenge (challenge.id)}
                <ChallengeCard
                  {challenge}
                  sharer={challengeSharerName(challenge)}
                  on:take={() => takeChallenge(challenge)}
                  on:results={() => showChallengeResults(challenge)}
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

          <form class="panel settings-form" on:submit|preventDefault={saveSettings}>
            <h2>{$t.groups.settingsTitle}</h2>

            <div class="field">
              <label for="group-name">{$t.groups.rename}</label>
              <input id="group-name" type="text" bind:value={settingsName} maxlength="60" disabled={busy} />
            </div>

            <div class="field">
              <div class="label-row">
                <label for="group-description">{$t.groups.description}</label>
                <span>{settingsDescription.length}/280</span>
              </div>
              <textarea
                id="group-description"
                bind:value={settingsDescription}
                maxlength="280"
                rows="3"
                placeholder={$t.groups.descriptionPlaceholder}
                disabled={busy}
              ></textarea>
            </div>

            <div class="field">
              <span class="field-label">{$t.groups.icon}</span>
              <div class="icon-grid" role="radiogroup" aria-label={$t.groups.icon}>
                <button
                  type="button"
                  class:selected={settingsIcon === null}
                  disabled={busy}
                  aria-pressed={settingsIcon === null}
                  on:click={() => (settingsIcon = null)}
                >
                  {$t.groups.iconNone}
                </button>
                {#each iconOptions as option}
                  <button
                    type="button"
                    class:selected={settingsIcon === option}
                    disabled={busy}
                    aria-pressed={settingsIcon === option}
                    on:click={() => (settingsIcon = option)}
                  >
                    {option}
                  </button>
                {/each}
              </div>
            </div>

            <fieldset class="field">
              <legend>{$t.groups.joinPolicy}</legend>
              <div class="segmented">
                <label>
                  <input type="radio" bind:group={settingsJoinPolicy} value="open" disabled={busy} />
                  <span>{$t.groups.joinPolicyOpen}</span>
                  <small>{$t.groups.joinPolicyOpenHint}</small>
                </label>
                <label>
                  <input type="radio" bind:group={settingsJoinPolicy} value="approval" disabled={busy} />
                  <span>{$t.groups.joinPolicyApproval}</span>
                  <small>{$t.groups.joinPolicyApprovalHint}</small>
                </label>
              </div>
            </fieldset>

            <fieldset class="field">
              <legend>{$t.groups.sharePolicy}</legend>
              <div class="segmented">
                <label>
                  <input type="radio" bind:group={settingsSharePolicy} value="members" disabled={busy} />
                  <span>{$t.groups.sharePolicyAll}</span>
                </label>
                <label>
                  <input type="radio" bind:group={settingsSharePolicy} value="owner" disabled={busy} />
                  <span>{$t.groups.sharePolicyOwner}</span>
                </label>
              </div>
            </fieldset>

            <div class="field">
              <label for="group-member-cap">{$t.groups.memberCap}</label>
              <input id="group-member-cap" type="number" min="1" bind:value={settingsMemberCap} disabled={busy} />
              <p class="field-hint">{$t.groups.memberCapHint}</p>
            </div>

            <button type="submit" class="action primary save-settings" disabled={busy || !settingsName.trim() || !settingsChanged}>{$t.common.save}</button>
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

<ChallengePickerSheet
  bind:open={challengePickerOpen}
  {gid}
  on:posted={async () => {
    challengePickerOpen = false;
    await refreshChallenges();
  }}
  on:close={() => (challengePickerOpen = false)}
/>

<style>
  .page { max-width: 720px; margin: 0 auto; padding: 20px 16px 80px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .header h1 { margin-bottom: 2px; overflow-wrap: anywhere; }
  .group-title { display: flex; align-items: center; gap: 8px; }
  .group-icon { flex: 0 0 auto; line-height: 1; }
  .member-count, .muted { margin: 0; color: var(--muted); font-size: 13px; }
  .group-description { margin: 4px 0 0; color: var(--muted); font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
  .invite { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: var(--muted); font-size: 12px; }
  .invite code { color: var(--text); font-family: var(--font-mono); font-size: 15px; font-weight: 700; letter-spacing: 1px; }
  .tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 20px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); }
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
  .challenges-panel { margin-top: 12px; }
  .challenge-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
  .challenge-toolbar h2 { margin: 0; color: var(--text); font-size: 15px; }
  .challenge-toolbar p { margin: 2px 0 0; color: var(--muted); font-size: 12px; }
  .challenge-button { flex: 0 0 auto; }
  .challenge-list { overflow: hidden; }
  .challenge-list :global(.challenge-card + .challenge-card) { border-top: 1px solid var(--border); }
  .results-actions { display: flex; justify-content: flex-start; margin-top: 12px; }
  .manage-stack { display: flex; flex-direction: column; }
  .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; color: var(--text); font-size: 14px; font-weight: 500; }
  .setting-row input { width: 20px; height: 20px; accent-color: var(--primary); }
  .owner-section, .settings-form, .danger-zone { padding: 16px; }
  .owner-section h2, .settings-form h2 { margin: 0 0 12px; color: var(--text); font-size: 15px; }
  .request-list { display: flex; flex-direction: column; gap: 10px; }
  .request-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text); font-size: 14px; }
  .request-row > span { min-width: 0; overflow-wrap: anywhere; }
  .request-actions, .confirm-actions { display: flex; align-items: center; gap: 8px; }
  .settings-form { display: flex; flex-direction: column; gap: 14px; }
  .field { display: flex; flex-direction: column; gap: 7px; min-width: 0; margin: 0; padding: 0; border: 0; }
  .field label, .field-label, .field legend { color: var(--text); font-size: 14px; font-weight: 600; }
  .label-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .label-row span, .field-hint { margin: 0; color: var(--muted); font-size: 12px; }
  .field input[type="text"], .field input[type="number"], .field textarea, .field > input:not([type]) { padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; }
  .field textarea { resize: vertical; min-height: 82px; }
  .icon-grid { display: flex; flex-wrap: wrap; gap: 7px; }
  .icon-grid button { min-width: 38px; min-height: 34px; padding: 6px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; cursor: pointer; }
  .icon-grid button.selected { border-color: var(--primary); background: var(--primary); color: var(--bg); }
  .icon-grid button:disabled { cursor: default; opacity: 0.55; }
  .segmented { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .segmented label { display: flex; flex-direction: column; gap: 3px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); cursor: pointer; }
  .segmented input { position: absolute; opacity: 0; pointer-events: none; }
  .segmented label:has(input:checked) { border-color: var(--primary); background: var(--bg3); }
  .segmented span { color: var(--text); font-size: 13px; font-weight: 700; }
  .segmented small { color: var(--muted); font-size: 12px; line-height: 1.35; }
  .save-settings { align-self: flex-start; }
  .action { min-height: 36px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg3); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .action.primary { border-color: var(--primary); background: var(--primary); color: var(--bg); }
  .action.danger { border-color: var(--danger); background: var(--danger-soft); color: var(--text); }
  .action:disabled { cursor: default; opacity: 0.55; }
  .inline-confirm { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text); font-size: 14px; }
  .inline-confirm div:first-child { display: flex; flex-direction: column; gap: 2px; }
  .inline-confirm span { color: var(--muted); font-size: 12px; }

  @media (max-width: 520px) {
    .header { flex-direction: column; }
    .group-title { align-items: flex-start; }
    .invite { align-items: flex-start; }
    .request-row, .inline-confirm { align-items: flex-start; flex-direction: column; }
    .request-actions, .confirm-actions { width: 100%; }
    .request-actions .action, .confirm-actions .action { flex: 1; }
    .challenge-toolbar { align-items: stretch; flex-direction: column; }
    .challenge-button { width: 100%; }
    .segmented { grid-template-columns: 1fr; }
    .save-settings { width: 100%; }
  }
</style>
