<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { goto, beforeNavigate } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { loadData, notes, subjects, getAuthContext } from '$lib/stores/data';
  import { notesRepo } from '$lib/data/entities';
  import { normalizeTags } from '$lib/notes';
  import { insertLink, toggleLinePrefix, toggleWrap } from '$lib/notesFormat';
  import LiveEditor from '$lib/components/notes/LiveEditor.svelte';
  import Picker from '$lib/components/Picker.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { t } from '$lib/i18n';
  import type { Note } from '$lib/types';

  const SAVE_DEBOUNCE_MS = 800;

  let id = '';
  $: id = $page.params.id ?? '';

  let title = '';
  let body = '';
  let tags: string[] = [];
  let subjectId: string | undefined = undefined;
  let pinned = false;
  let createdAt = '';
  let tagDraft = '';
  let confirmDelete = false;
  let titleEl: HTMLInputElement;
  let editorRef: LiveEditor;

  let loaded = false;     // editing enabled (autosave armed)
  let hydrated = false;   // local fields populated from the store
  let hydrating = false;  // hydrate() in flight
  let persisted = false;  // has been written to the repo at least once
  let deleted = false;
  let focusedNewNote = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Populate local editing state once, after auth resolves and data has loaded.
  // On a full reload onMount fires while auth is still 'loading' (loadData no-ops),
  // so we also react to auth resolution — guarded to run exactly once.
  async function hydrate() {
    if (hydrated || hydrating || $auth.mode === 'loading' || !id) return;
    hydrating = true;
    await loadData($auth);
    const existing = get(notes).find((n) => n.id === id);
    if (existing) {
      title = existing.title;
      body = existing.body;
      tags = [...existing.tags];
      subjectId = existing.subjectId;
      pinned = existing.pinned;
      createdAt = existing.createdAt;
      persisted = true;
    } else {
      createdAt = new Date().toISOString();
    }
    hydrated = true;
    loaded = true;
    hydrating = false;
  }

  onMount(hydrate);
  $: if (!hydrated && !hydrating && $auth.mode !== 'loading' && id) hydrate();
  $: if (hydrated && !persisted && !focusedNewNote && titleEl) {
    focusedNewNote = true;
    void tick().then(() => titleEl.focus());
  }

  $: subjectOptions = $subjects.map((s) => ({ value: s.id, label: s.name, color: s.color }));

  function isBlank(): boolean {
    return title.trim() === '' && body.trim() === '' && tags.length === 0;
  }

  function buildNote(): Note {
    return {
      id,
      userId: getAuthContext().userId,
      subjectId,
      title: title.trim(),
      body,
      tags: normalizeTags(tags),
      pinned,
      createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  async function flush(): Promise<void> {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (deleted || isBlank()) return;
    await notesRepo.save(buildNote());
    persisted = true;
  }

  function scheduleSave() {
    if (!loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flush(); }, SAVE_DEBOUNCE_MS);
  }

  // Any tracked field change schedules a save.
  $: if (loaded) { title; body; tags; subjectId; pinned; scheduleSave(); }

  // Formatting goes through the editor component (Ctrl/Cmd-B/I/K live in its
  // own keymap); the pure notesFormat helpers stay the single edit source.
  function applyBodyEdit(
    edit: (text: string, selStart: number, selEnd: number) => { text: string; selStart: number; selEnd: number }
  ) {
    if (!hydrated || !editorRef) return;
    editorRef.applyEdit(edit);
  }

  function addTag() {
    const next = normalizeTags([...tags, tagDraft]);
    tags = next;
    tagDraft = '';
  }
  function removeTag(tag: string) {
    tags = tags.filter((x) => x !== tag);
  }
  function onTagKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addTag(); }
  }

  async function doDelete() {
    confirmDelete = false;
    deleted = true;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (persisted) await notesRepo.remove(id);
    goto('/notes');
  }

  // Flush (or discard) before leaving the route and on tab suspension.
  beforeNavigate(() => { void flush(); });
  function onPageHide() { void flush(); }
  onMount(() => {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('visibilitychange', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('visibilitychange', onPageHide);
    };
  });
  onDestroy(() => {
    if (saveTimer) clearTimeout(saveTimer);
  });
</script>

<div class="editor">
  <header class="editor-bar">
    <a class="back" href="/notes" aria-label={$t.notes.back}>‹ {$t.notes.back}</a>
    <div class="bar-actions">
      <button class="pin-toggle" class:on={pinned} disabled={!hydrated} on:click={() => (pinned = !pinned)}>
        {pinned ? $t.notes.unpin : $t.notes.pin}
      </button>
      <button class="delete-btn" disabled={!hydrated} on:click={() => (confirmDelete = true)}>{$t.notes.delete}</button>
    </div>
  </header>

  <input
    class="title-input"
    bind:this={titleEl}
    bind:value={title}
    disabled={!hydrated}
    placeholder={$t.notes.titlePlaceholder}
    aria-label={$t.notes.titlePlaceholder}
  />

  <div class="meta-row">
    <Picker
      value={subjectId ?? ''}
      options={subjectOptions}
      disabled={!hydrated}
      placeholder={$t.notes.unfiled}
      ariaLabel={$t.notes.unfiled}
      on:change={(e) => (subjectId = e.detail.value || undefined)}
    />
  </div>

  <div class="tags-row">
    {#each tags as tag (tag)}
      <span class="tag-chip">#{tag}<button class="tag-x" on:click={() => removeTag(tag)} aria-label="remove {tag}">×</button></span>
    {/each}
    <input
      class="tag-input"
      bind:value={tagDraft}
      disabled={!hydrated}
      on:keydown={onTagKey}
      on:blur={addTag}
      placeholder={$t.notes.tagsPlaceholder}
      aria-label={$t.notes.tagsPlaceholder}
    />
  </div>

  <div class="format-toolbar" aria-label={$t.notes.write}>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.bold} on:click={() => applyBodyEdit((text, start, end) => toggleWrap(text, start, end, '**', '**'))}>
        <strong>B</strong>
      </button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.italic} on:click={() => applyBodyEdit((text, start, end) => toggleWrap(text, start, end, '*', '*'))}>
        <em>I</em>
      </button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.heading} on:click={() => applyBodyEdit((text, start, end) => toggleLinePrefix(text, start, end, '## '))}>H</button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.bulletList} on:click={() => applyBodyEdit((text, start, end) => toggleLinePrefix(text, start, end, '- '))}>-</button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.numberedList} on:click={() => applyBodyEdit((text, start, end) => toggleLinePrefix(text, start, end, '1. '))}>1.</button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.checklist} on:click={() => applyBodyEdit((text, start, end) => toggleLinePrefix(text, start, end, '- [ ] '))}>☐</button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.quote} on:click={() => applyBodyEdit((text, start, end) => toggleLinePrefix(text, start, end, '> '))}>“</button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.code} on:click={() => applyBodyEdit((text, start, end) => toggleWrap(text, start, end, '`', '`'))}>`</button>
      <button type="button" disabled={!hydrated} aria-label={$t.notes.link} on:click={() => applyBodyEdit(insertLink)}>↗</button>
  </div>

  <LiveEditor
    bind:this={editorRef}
    value={body}
    disabled={!hydrated}
    placeholder={$t.notes.bodyPlaceholder}
    on:change={(e) => (body = e.detail)}
  />
</div>

<ConfirmDialog
  open={confirmDelete}
  message={$t.notes.deleteConfirm}
  on:confirm={doDelete}
  on:cancel={() => (confirmDelete = false)}
/>

<style>
  .editor { max-width: 760px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 100%; }
  .editor-bar { display: flex; align-items: center; justify-content: space-between; }
  .back { color: var(--muted); text-decoration: none; font-size: 14px; }
  .back:hover { color: var(--text); }
  .bar-actions { display: flex; gap: 8px; }
  .pin-toggle, .delete-btn { padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg2); color: var(--muted); font-size: 13px; font-family: inherit; cursor: pointer; }
  .pin-toggle.on { background: var(--primary-l); color: var(--primary); border-color: transparent; }
  .title-input { width: 100%; border: none; background: transparent; color: var(--text); font-size: 24px; font-weight: 700; font-family: inherit; padding: 4px 0; }
  .title-input:focus { outline: none; }
  .meta-row { max-width: 280px; }
  .tags-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .tag-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--primary); background: var(--primary-l); padding: 2px 8px; border-radius: 999px; }
  .tag-x { border: none; background: transparent; color: inherit; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; }
  .tag-input { border: none; background: transparent; color: var(--text); font-size: 13px; font-family: inherit; min-width: 120px; flex: 1; }
  .tag-input:focus { outline: none; }
  .format-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; width: max-content; max-width: 100%; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); }
  .format-toolbar button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: calc(var(--radius-md) - 2px); background: transparent; color: var(--muted); font-size: 14px; font-family: var(--font-sans); font-weight: 700; line-height: 1; cursor: pointer; transition: background 120ms ease, color 120ms ease, transform 120ms ease; }
  .format-toolbar button:hover:not(:disabled), .format-toolbar button:focus-visible { background: var(--bg3); color: var(--text); transform: translateY(-1px); }
  .format-toolbar button:disabled { cursor: not-allowed; opacity: 0.5; }
</style>
