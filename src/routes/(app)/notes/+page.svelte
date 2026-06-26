<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { loadData, notes, subjects } from '$lib/stores/data';
  import { filterNotes } from '$lib/notes';
  import { newId } from '$lib/id';
  import { t } from '$lib/i18n';

  let query = '';
  let subjectFilter: string | null | undefined = undefined; // undefined = All, null = Unfiled
  let tagFilter: string | null = null;

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  // Subjects that actually have notes, plus whether any note is unfiled.
  $: subjectsWithNotes = $subjects.filter((s) => $notes.some((n) => n.subjectId === s.id));
  $: hasUnfiled = $notes.some((n) => n.subjectId === undefined);
  $: allTags = Array.from(new Set($notes.flatMap((n) => n.tags))).sort();

  $: visible = filterNotes($notes, { query, subjectId: subjectFilter, tag: tagFilter });

  function subjectName(id?: string): string {
    return $subjects.find((s) => s.id === id)?.name ?? $t.notes.unfiled;
  }
  function snippet(body: string): string {
    return body.replace(/[#*_`>\-\[\]!]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  function newNote() {
    goto(`/notes/${newId()}`);
  }
</script>

<div class="notes-page">
  <header class="notes-header">
    <h1>{$t.notes.title}</h1>
    <button class="new-btn" on:click={newNote}>+ {$t.notes.newNote}</button>
  </header>

  <input
    class="search"
    type="search"
    bind:value={query}
    placeholder={$t.notes.searchPlaceholder}
    aria-label={$t.notes.searchPlaceholder}
  />

  <div class="chips" role="group" aria-label="Subject filter">
    <button class="chip" class:active={subjectFilter === undefined} on:click={() => (subjectFilter = undefined)}>{$t.notes.allSubjects}</button>
    {#each subjectsWithNotes as s (s.id)}
      <button class="chip" class:active={subjectFilter === s.id} on:click={() => (subjectFilter = s.id)}>{s.name}</button>
    {/each}
    {#if hasUnfiled}
      <button class="chip" class:active={subjectFilter === null} on:click={() => (subjectFilter = null)}>{$t.notes.unfiled}</button>
    {/if}
  </div>

  {#if allTags.length}
    <div class="chips" role="group" aria-label="Tag filter">
      <button class="chip" class:active={tagFilter === null} on:click={() => (tagFilter = null)}>{$t.notes.allTags}</button>
      {#each allTags as tag (tag)}
        <button class="chip" class:active={tagFilter === tag} on:click={() => (tagFilter = tag)}>#{tag}</button>
      {/each}
    </div>
  {/if}

  {#if $notes.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.notes.emptyTitle}</p>
      <p class="empty-sub">{$t.notes.emptySub}</p>
    </div>
  {:else if visible.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$t.notes.noMatches}</p>
    </div>
  {:else}
    <ul class="note-list">
      {#each visible as note (note.id)}
        <li>
          <a class="note-row" href={`/notes/${note.id}`}>
            <div class="row-main">
              <span class="row-title">
                {#if note.pinned}<span class="pin-dot" aria-hidden="true">📌</span>{/if}
                {note.title || $t.notes.titlePlaceholder}
              </span>
              {#if snippet(note.body)}<span class="row-snippet">{snippet(note.body)}</span>{/if}
            </div>
            <div class="row-meta">
              <span class="row-subject">{subjectName(note.subjectId)}</span>
              {#each note.tags as tag (tag)}<span class="tag-badge">#{tag}</span>{/each}
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .notes-page { max-width: 760px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .notes-header { display: flex; align-items: center; justify-content: space-between; }
  .notes-header h1 { font-size: 22px; font-weight: 700; color: var(--text); }
  .new-btn { padding: 8px 14px; border: none; border-radius: var(--radius-md); background: var(--primary); color: var(--bg); font-weight: 600; font-family: inherit; cursor: pointer; }
  .search { width: 100%; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--radius-md); background: var(--bg3); color: var(--text); font-size: 14px; font-family: inherit; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg2); color: var(--muted); font-size: 13px; font-family: inherit; cursor: pointer; }
  .chip.active { background: var(--primary-l); color: var(--primary); border-color: transparent; font-weight: 600; }
  .note-list { display: flex; flex-direction: column; gap: 8px; list-style: none; }
  .note-row { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); text-decoration: none; color: var(--text); }
  .note-row:hover { background: var(--bg3); }
  .row-main { display: flex; flex-direction: column; gap: 2px; }
  .row-title { font-size: 15px; font-weight: 600; }
  .pin-dot { font-size: 12px; }
  .row-snippet { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .row-subject { font-size: 12px; color: var(--muted); }
  .tag-badge { font-size: 11px; color: var(--primary); background: var(--primary-l); padding: 1px 7px; border-radius: 999px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
</style>
