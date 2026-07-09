<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { myGroups, loadMyGroups, createGroup, joinGroup } from '$lib/groups';
  import GroupCard from '$lib/components/groups/GroupCard.svelte';
  import { t } from '$lib/i18n';
  import { toast } from '$lib/stores/toast';

  let name = ''; let code = '';
  onMount(() => { if ($auth.mode === 'authenticated') loadMyGroups(); });
  $: if ($auth.mode === 'authenticated') loadMyGroups();

  async function onCreate() { if (name.trim()) { await createGroup(name.trim()); name=''; } }
  async function onJoin() {
    if (!code.trim()) return;
    const status = await joinGroup(code.trim());
    if (status === 'approved') toast.success($t.groups.joinedToast);
    if (status === 'pending') toast.success($t.groups.requestSentToast);
    if (status) code = '';
  }
</script>

<div class="page">
  <h1 class="text-large-title">{$t.groups.title}</h1>
  {#if $auth.mode !== 'authenticated'}
    <div class="empty-state"><p class="empty-title">{$t.groups.signInPrompt}</p></div>
  {:else}
    <div class="actions">
      <input class="g-input" bind:value={name} placeholder={$t.groups.namePlaceholder} />
      <button class="btn btn-primary" on:click={onCreate}>{$t.groups.create}</button>
    </div>
    <div class="actions">
      <input class="g-input" bind:value={code} placeholder={$t.groups.codePlaceholder} />
      <button class="btn btn-secondary" on:click={onJoin}>{$t.groups.join}</button>
    </div>
    {#if $myGroups.length === 0}
      <div class="empty-state"><p class="empty-title">{$t.groups.empty}</p><p class="empty-sub">{$t.groups.emptySub}</p></div>
    {:else}
      <div class="g-list">{#each $myGroups as g (g.id)}<GroupCard group={g} />{/each}</div>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 20px 16px 80px; max-width: 600px; margin: 0 auto; }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
  .g-input { flex: 1; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); color: var(--text); font-family: inherit; font-size: 15px; outline: none; }
  .g-list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; margin-top: 16px; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }

  @media (min-width: 1024px) {
    .page { max-width: 900px; }
    .g-list { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: start; }
  }
</style>
