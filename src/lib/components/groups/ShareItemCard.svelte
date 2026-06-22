<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { deleteShare, importShare, type GroupShare } from '$lib/groups';
  import { t } from '$lib/i18n';

  export let share: GroupShare;
  export let sharer: string;
  export let canDelete = false;

  const dispatch = createEventDispatcher<{ refresh: void }>();
  let importing = false;
  let deleting = false;

  async function addToAccount() {
    if (importing) return;
    importing = true;
    try {
      await importShare(share);
    } finally {
      importing = false;
    }
  }

  async function remove() {
    if (deleting) return;
    deleting = true;
    try {
      if (await deleteShare(share.id)) dispatch('refresh');
    } finally {
      deleting = false;
    }
  }
</script>

<article class="share-card">
  <div class="kind-icon" aria-hidden="true">
    {#if share.kind === 'flashcard_deck'}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M8 8h8M8 12h6" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="m8 9 1.5 1.5L12 8M13 10h3M8 15h8" />
      </svg>
    {/if}
  </div>

  <div class="share-copy">
    <p class="kind">{share.kind === 'flashcard_deck' ? $t.groups.shareDeck : $t.groups.shareExam}</p>
    <h3>{share.title}</h3>
    <p class="sharer">{$t.groups.sharedBy(sharer)}</p>
  </div>

  <div class="actions">
    <button type="button" class="import" disabled={importing || deleting} on:click={addToAccount}>
      {$t.groups.addToAccount}
    </button>
    {#if canDelete}
      <button type="button" class="delete" disabled={importing || deleting} aria-label={$t.common.delete} on:click={remove}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      </button>
    {/if}
  </div>
</article>

<style>
  .share-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .kind-icon { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; background: var(--primary-l); color: var(--primary); }
  .kind-icon svg { width: 21px; height: 21px; }
  .share-copy { flex: 1; min-width: 0; }
  .kind, .sharer { margin: 0; color: var(--muted); font-size: 11px; }
  .kind { font-weight: 600; }
  h3 { margin: 2px 0; overflow-wrap: anywhere; color: var(--text); font-size: 14px; font-weight: 650; }
  .actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
  button { min-height: 36px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  button:disabled { cursor: default; opacity: 0.55; }
  .import { padding: 7px 10px; border: 1px solid var(--primary); background: var(--primary); color: var(--bg); }
  .delete { width: 36px; padding: 7px; display: grid; place-items: center; border: 1px solid var(--border); background: var(--bg3); color: var(--muted); }
  .delete svg { width: 17px; height: 17px; }

  @media (max-width: 560px) {
    .share-card { align-items: flex-start; flex-wrap: wrap; }
    .actions { width: 100%; padding-left: 50px; }
    .import { flex: 1; }
    button { min-height: 44px; }
    .delete { width: 44px; }
  }
</style>
