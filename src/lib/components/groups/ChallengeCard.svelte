<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '$lib/i18n';
  import type { GroupChallenge } from '$lib/groups';

  export let challenge: GroupChallenge;
  export let sharer: string;

  const dispatch = createEventDispatcher<{ take: void; results: void }>();
</script>

<article class="challenge-card">
  <div class="kind-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="m8 9 1.5 1.5L12 8M13 10h3M8 15h8" />
    </svg>
  </div>

  <div class="challenge-copy">
    <h3>{challenge.title}</h3>
    <p>{$t.groups.sharedBy(sharer)} &middot; {$t.groups.questions(challenge.payload.questions.length)}</p>
  </div>

  <div class="actions">
    <button type="button" class="take" on:click={() => dispatch('take')}>{$t.groups.take}</button>
    <button type="button" class="results" on:click={() => dispatch('results')}>{$t.groups.viewResults}</button>
  </div>
</article>

<style>
  .challenge-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .kind-icon { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; background: var(--primary-l); color: var(--primary); }
  .kind-icon svg { width: 21px; height: 21px; }
  .challenge-copy { flex: 1; min-width: 0; }
  h3 { margin: 0 0 2px; overflow-wrap: anywhere; color: var(--text); font-size: 14px; font-weight: 650; }
  p { margin: 0; color: var(--muted); font-size: 11px; }
  .actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
  button { min-height: 36px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  .take { padding: 7px 10px; border: 1px solid var(--primary); background: var(--primary); color: var(--bg); }
  .results { padding: 7px 10px; border: 1px solid var(--border); background: var(--bg3); color: var(--text); }

  @media (max-width: 560px) {
    .challenge-card { align-items: flex-start; flex-wrap: wrap; }
    .actions { width: 100%; padding-left: 50px; }
    .take, .results { flex: 1; min-height: 44px; }
  }
</style>
