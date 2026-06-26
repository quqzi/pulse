# Notes (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone, dual-mode (guest localStorage / authenticated Supabase) Notes feature for Pulse — subject-linked, tag-organized, Markdown-bodied notes with a `/notes` list and a `/notes/[id]` full-screen autosaving editor.

**Architecture:** Notes flow through the existing repo engine — one `repo<Note>()` bound to a `notes` writable store, with a snake↔camel mapper pair; the engine handles the guest/auth mode switch and error toasts. A pure `filterNotes` helper and a sanitizing `renderMarkdown` (marked + DOMPurify, dynamically imported) keep logic testable and off the main bundle. The list and editor are SvelteKit routes under `(app)`; the editor autosaves via a debounce flushed on navigate/pagehide.

**Tech Stack:** SvelteKit 2 + TypeScript (Svelte 4 idiom: `export let`, `createEventDispatcher`, scoped CSS), Supabase JS v2 (Postgres + RLS), Vitest (unit), `marked` + `dompurify` for Markdown, plain CSS custom-property tokens.

## Global Constraints

- Source spec: `docs/superpowers/specs/2026-06-25-notes-design.md`.
- localStorage key uses the **DOT** namespace: `pulse.notes` (never `pulse_notes`).
- DB columns are `snake_case`; TS fields `camelCase` — every entity needs a mapper pair in `mappers.ts`.
- `repo.load/save/remove` **write through to the bound store** — never manually `.set()` the store after calling them.
- No try/catch in pages — the repo engine catches persistence errors and surfaces `toast.error`.
- Never hardcode colors — use CSS tokens (`--bg --bg2 --bg3 --border --text --muted --primary --primary-l --radius-md` …). Any new token must exist in **all five** theme blocks in `app.css`.
- No `transition: width/height` — use `transform: scaleX/scaleY`.
- i18n strings go in **both** `src/lib/i18n/en.ts` and `src/lib/i18n/th.ts`; nav labels are typed `NavKey = keyof I18n['nav']`.
- `updatedAt` / timestamps use `new Date().toISOString()`; date-only values (none here) would use `localDateStr`, never `toISOString()`.
- Markdown sanitization is **mandatory** (Phase 2 shares note bodies) — render must never emit raw `<script>`, inline `on*=` handlers, or `javascript:` URLs.
- `npm run check` must be zero-error before every commit.
- Applying the Supabase migration to prod is a **production action** — requires explicit user go-ahead; the migration file is created but NOT applied in this plan.
- Implementation handed to Codex; Claude orchestrates/verifies (`npm run check`, `npx vitest run`, browser-verify).

---

### Task 1: `Note` type + mapper pair

**Files:**
- Modify: `src/lib/types.ts` (add `Note` interface near the other entity interfaces, e.g. after `Task`)
- Modify: `src/lib/data/mappers.ts` (add `noteFromRow` / `noteToRow`; add `Note` to the type import on line 1)
- Test: `src/lib/data/mappers.test.ts` (add a `note mapper` describe block)

**Interfaces:**
- Produces: `interface Note { id: string; userId: string; subjectId?: string; title: string; body: string; tags: string[]; pinned: boolean; createdAt: string; updatedAt: string }`
- Produces: `noteFromRow(r: Record<string, unknown>): Note`, `noteToRow(n: Note): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/data/mappers.test.ts`:

```typescript
import { noteFromRow, noteToRow } from '$lib/data/mappers';
import type { Note } from '$lib/types';

describe('note mapper', () => {
  it('round-trips a fully-populated note', () => {
    const n: Note = {
      id: 'n1', userId: 'u', subjectId: 'sub1', title: 'Kinematics',
      body: '# v = u + at', tags: ['physics', 'mechanics'], pinned: true,
      createdAt: '2026-06-26T10:00:00.000Z', updatedAt: '2026-06-26T11:00:00.000Z',
    };
    const row = noteToRow(n);
    expect(row.user_id).toBe('u');
    expect(row.subject_id).toBe('sub1');
    expect(row.tags).toEqual(['physics', 'mechanics']);
    expect(row.pinned).toBe(true);
    expect(noteFromRow(row)).toEqual(n);
  });

  it('maps an unfiled note: subjectId undefined <-> subject_id null', () => {
    const n: Note = {
      id: 'n2', userId: 'u', subjectId: undefined, title: '', body: '',
      tags: [], pinned: false,
      createdAt: '2026-06-26T10:00:00.000Z', updatedAt: '2026-06-26T10:00:00.000Z',
    };
    const row = noteToRow(n);
    expect(row.subject_id).toBe(null);
    expect(row.tags).toEqual([]);
    expect(noteFromRow(row)).toEqual(n);
  });

  it('defaults a row with null tags to an empty array', () => {
    const row = {
      id: 'n3', user_id: 'u', subject_id: null, title: 't', body: 'b',
      tags: null, pinned: false,
      created_at: '2026-06-26T10:00:00.000Z', updated_at: '2026-06-26T10:00:00.000Z',
    };
    expect(noteFromRow(row).tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/mappers.test.ts`
Expected: FAIL — `noteFromRow`/`noteToRow` are not exported (import error), and `Note` type missing.

- [ ] **Step 3: Add the `Note` interface**

In `src/lib/types.ts`, add (after the `Task` interface):

```typescript
export interface Note {
  id: string;
  userId: string;
  subjectId?: string;   // optional FK -> subject; unset = "Unfiled"
  title: string;
  body: string;         // Markdown source text
  tags: string[];       // free-text tags, lowercased + de-duped on save
  pinned: boolean;
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp — bumped on every save; drives list sort
}
```

- [ ] **Step 4: Add the mapper pair**

In `src/lib/data/mappers.ts`, add `Note` to the existing `import type { ... } from '$lib/types';` on line 1, then append:

```typescript
export const noteFromRow = (r: Record<string, unknown>): Note => ({
  id: r.id as string,
  userId: r.user_id as string,
  subjectId: (r.subject_id as string | null) ?? undefined,
  title: r.title as string,
  body: r.body as string,
  tags: (r.tags as string[] | null) ?? [],
  pinned: (r.pinned as boolean | null) ?? false,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export const noteToRow = (n: Note): Record<string, unknown> => ({
  id: n.id,
  user_id: n.userId,
  subject_id: n.subjectId ?? null,
  title: n.title,
  body: n.body,
  tags: n.tags,
  pinned: n.pinned,
  created_at: n.createdAt,
  updated_at: n.updatedAt,
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/data/mappers.test.ts`
Expected: PASS (all `note mapper` tests green).

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/data/mappers.ts src/lib/data/mappers.test.ts
git commit -m "feat(notes): Note type + row mapper pair"
```

---

### Task 2: `notes` store + `notesRepo` + loadData wiring

**Files:**
- Modify: `src/lib/data/stores.ts` (add `notes` writable; add `Note` to the type import)
- Modify: `src/lib/data/entities.ts` (add `notesRepo`; add `notes` to the stores import, `Note` to the types import, `noteFromRow`/`noteToRow` to the mappers import)
- Modify: `src/lib/stores/data.ts` (import `notes`, re-export it, import `notesRepo`, add `notesRepo.load()` to `loadData`)

**Interfaces:**
- Consumes: `Note` (Task 1), `noteFromRow`/`noteToRow` (Task 1)
- Produces: `notes: Writable<Note[]>`, `notesRepo` with `.load() / .save(note) / .remove(id)` (write-through)

- [ ] **Step 1: Add the store**

In `src/lib/data/stores.ts`, add `Note` to the `import type { ... } from '$lib/types';` list, then append after the `flashcards` line:

```typescript
export const notes = writable<Note[]>([]);
```

- [ ] **Step 2: Add the repo**

In `src/lib/data/entities.ts`:
- add `Note` to the `import type { ... } from '$lib/types';` (line 2),
- add `notes` to the `import { ... } from '$lib/data/stores';` (line 3),
- add `noteFromRow, noteToRow` to the `import { ... } from '$lib/data/mappers';` (line 6),

then add (next to `tasksRepo`):

```typescript
export const notesRepo = repo<Note>({
  store: notes,
  lsKey: 'pulse.notes',
  table: 'notes',
  toRow: noteToRow,
  fromRow: noteFromRow,
  orderColumn: 'updated_at',
  ascending: false,
  order: (a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;  // pinned first
    return b.updatedAt.localeCompare(a.updatedAt);         // then most-recent
  },
});
```

- [ ] **Step 3: Wire loadData + re-export**

In `src/lib/stores/data.ts`:
- add `notes` to the `import { ... } from '$lib/data/stores';` (ends line 5),
- add `notesRepo` to the `import { ... } from '$lib/data/entities';` (line 6),
- add `notes` to the `export { ... };` re-export on line 15,
- add `notesRepo.load(),` to the `Promise.all([...])` in `loadData` (after `flashcardsRepo.load(),`):

```typescript
  await Promise.all([
    tasksRepo.load(),
    scoresRepo.load(),
    subjectsRepo.load(),
    topicsRepo.load(),
    sessionsRepo.load(),
    templatesRepo.load(),
    examQuestionsRepo.load(),
    examSessionsRepo.load(),
    flashcardsRepo.load(),
    notesRepo.load(),
  ]);
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Run the full unit suite (no regressions)**

Run: `npx vitest run`
Expected: PASS (engine/mapper tests still green; nothing references `notes` yet beyond wiring).

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/stores.ts src/lib/data/entities.ts src/lib/stores/data.ts
git commit -m "feat(notes): notes store, repo, and loadData wiring"
```

---

### Task 3: `filterNotes` + `normalizeTags` pure helpers

**Files:**
- Create: `src/lib/notes.ts`
- Test: `src/lib/notes.test.ts`

**Interfaces:**
- Consumes: `Note` (Task 1)
- Produces:
  - `normalizeTags(tags: string[]): string[]` — trims, lowercases, drops empties, de-dupes (order-preserving)
  - `filterNotes(list: Note[], opts: { query?: string; subjectId?: string | null; tag?: string | null }): Note[]` — returns filtered + sorted (pinned first, then `updatedAt` desc). `subjectId === undefined` = all; `subjectId === null` = Unfiled (no `subjectId`); `subjectId === '<id>'` = that subject. `query` matches title + body, case-insensitive substring. `tag` requires the note's `tags` to include it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/notes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeTags, filterNotes } from '$lib/notes';
import type { Note } from '$lib/types';

const mk = (over: Partial<Note>): Note => ({
  id: 'x', userId: 'u', subjectId: undefined, title: '', body: '',
  tags: [], pinned: false,
  createdAt: '2026-06-26T10:00:00.000Z', updatedAt: '2026-06-26T10:00:00.000Z',
  ...over,
});

describe('normalizeTags', () => {
  it('trims, lowercases, drops empties, de-dupes', () => {
    expect(normalizeTags([' Physics ', 'physics', '', '  ', 'MATH'])).toEqual(['physics', 'math']);
  });
});

describe('filterNotes', () => {
  const a = mk({ id: 'a', title: 'Newton laws', body: 'force = ma', subjectId: 's1', tags: ['physics'], updatedAt: '2026-06-26T12:00:00.000Z' });
  const b = mk({ id: 'b', title: 'Cells', body: 'mitochondria', subjectId: 's2', tags: ['bio'], updatedAt: '2026-06-26T13:00:00.000Z' });
  const c = mk({ id: 'c', title: 'Scratch', body: 'misc', subjectId: undefined, tags: ['physics'], pinned: true, updatedAt: '2026-06-26T09:00:00.000Z' });
  const all = [a, b, c];

  it('sorts pinned first, then updatedAt desc', () => {
    expect(filterNotes(all, {}).map(n => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('search matches title and body, case-insensitive', () => {
    expect(filterNotes(all, { query: 'NEWTON' }).map(n => n.id)).toEqual(['a']);
    expect(filterNotes(all, { query: 'mitochon' }).map(n => n.id)).toEqual(['b']);
  });

  it('subjectId null filters to Unfiled', () => {
    expect(filterNotes(all, { subjectId: null }).map(n => n.id)).toEqual(['c']);
  });

  it('subjectId id filters to that subject', () => {
    expect(filterNotes(all, { subjectId: 's2' }).map(n => n.id)).toEqual(['b']);
  });

  it('tag filter requires the tag', () => {
    expect(filterNotes(all, { tag: 'physics' }).map(n => n.id)).toEqual(['c', 'a']);
  });

  it('combines filters', () => {
    expect(filterNotes(all, { tag: 'physics', subjectId: 's1' }).map(n => n.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notes.test.ts`
Expected: FAIL — cannot find module `$lib/notes`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/notes.ts`:

```typescript
import type { Note } from '$lib/types';

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

interface FilterOpts {
  query?: string;
  subjectId?: string | null;
  tag?: string | null;
}

export function filterNotes(list: Note[], opts: FilterOpts): Note[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  return list
    .filter((n) => {
      if (q && !(n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))) return false;
      if (opts.subjectId === null && n.subjectId !== undefined) return false;
      if (typeof opts.subjectId === 'string' && n.subjectId !== opts.subjectId) return false;
      if (opts.tag && !n.tags.includes(opts.tag)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notes.test.ts`
Expected: PASS (all `normalizeTags` + `filterNotes` tests green).

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notes.ts src/lib/notes.test.ts
git commit -m "feat(notes): pure filterNotes + normalizeTags helpers"
```

---

### Task 4: Sanitizing Markdown renderer

**Files:**
- Modify: `package.json` (add `marked`, `dompurify` deps; `@types/dompurify`, `jsdom` devDeps)
- Create: `src/lib/markdown.ts`
- Test: `src/lib/markdown.test.ts`

**Interfaces:**
- Produces: `renderMarkdown(md: string): Promise<string>` — returns sanitized HTML; on any failure degrades to escaped plain text.

- [ ] **Step 1: Install dependencies**

```bash
npm install marked dompurify
npm install -D @types/dompurify jsdom
```

Expected: `package.json` + `package-lock.json` updated; no errors.

> `jsdom` is a devDep used only by the sanitization test (DOMPurify needs a DOM, and Vitest runs in the `node` environment by default — see `vitest.config.ts`). The app bundles only `marked` + `dompurify`, dynamically imported.

- [ ] **Step 2: Write the failing test**

Create `src/lib/markdown.test.ts` (the docblock switches just this file to jsdom):

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '$lib/markdown';

describe('renderMarkdown', () => {
  it('renders headings, bold, and lists', async () => {
    const out = await renderMarkdown('# Title\n\n**bold**\n\n- one\n- two');
    expect(out).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<li>');
  });

  it('strips <script> tags', async () => {
    const out = await renderMarkdown('ok\n\n<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips inline event handlers', async () => {
    const out = await renderMarkdown('<img src=x onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips javascript: URLs', async () => {
    const out = await renderMarkdown('[click](javascript:alert(1))');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: FAIL — cannot find module `$lib/markdown`.

- [ ] **Step 4: Implement the renderer**

Create `src/lib/markdown.ts`:

```typescript
// Sanitizing Markdown renderer. marked + DOMPurify are dynamically imported so
// they code-split onto the notes route and stay out of the main bundle.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderMarkdown(md: string): Promise<string> {
  const src = md ?? '';
  try {
    const [{ marked }, DOMPurifyMod] = await Promise.all([
      import('marked'),
      import('dompurify'),
    ]);
    const DOMPurify = DOMPurifyMod.default;
    const rawHtml = marked.parse(src, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  } catch {
    // Malformed input or no DOM available — degrade to escaped plain text.
    return escapeHtml(src);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: PASS (renders + all three sanitization cases green).

- [ ] **Step 6: Type-check + full suite**

Run: `npm run check` then `npx vitest run`
Expected: 0 type errors; all unit tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/markdown.ts src/lib/markdown.test.ts
git commit -m "feat(notes): sanitizing markdown renderer (marked + DOMPurify)"
```

---

### Task 5: i18n strings (nav + notes pages)

**Files:**
- Modify: `src/lib/i18n/en.ts` (add `notes` to the `nav` block; add a top-level `notes` section)
- Modify: `src/lib/i18n/th.ts` (mirror both)

**Interfaces:**
- Produces: `nav.notes`, and a `notes` i18n section: `{ title, newNote, searchPlaceholder, allSubjects, unfiled, allTags, titlePlaceholder, bodyPlaceholder, write, preview, tagsPlaceholder, pin, unpin, delete, deleteConfirm, emptyTitle, emptySub, noMatches, back }`.

- [ ] **Step 1: Add English strings**

In `src/lib/i18n/en.ts`, inside the `nav: { ... }` block, add after `flashcards: 'Flashcards',`:

```typescript
    notes: 'Notes',
```

Then add a top-level section (e.g. after the `flashcards` section):

```typescript
  notes: {
    title: 'Notes',
    newNote: 'New note',
    searchPlaceholder: 'Search notes…',
    allSubjects: 'All',
    unfiled: 'Unfiled',
    allTags: 'All tags',
    titlePlaceholder: 'Untitled note',
    bodyPlaceholder: 'Start writing… Markdown supported.',
    write: 'Write',
    preview: 'Preview',
    tagsPlaceholder: 'Add a tag…',
    pin: 'Pin',
    unpin: 'Unpin',
    delete: 'Delete',
    deleteConfirm: 'Delete this note? This cannot be undone.',
    emptyTitle: 'No notes yet.',
    emptySub: 'Create your first note to capture ideas and summaries.',
    noMatches: 'No notes match your filters.',
    back: 'Back',
  },
```

- [ ] **Step 2: Add Thai strings**

In `src/lib/i18n/th.ts`, inside the `nav: { ... }` block, add after the `flashcards` nav entry:

```typescript
    notes: 'โน้ต',
```

Then add the mirrored section:

```typescript
  notes: {
    title: 'โน้ต',
    newNote: 'โน้ตใหม่',
    searchPlaceholder: 'ค้นหาโน้ต…',
    allSubjects: 'ทั้งหมด',
    unfiled: 'ยังไม่จัดหมวด',
    allTags: 'แท็กทั้งหมด',
    titlePlaceholder: 'โน้ตไม่มีชื่อ',
    bodyPlaceholder: 'เริ่มเขียน… รองรับ Markdown',
    write: 'เขียน',
    preview: 'ดูตัวอย่าง',
    tagsPlaceholder: 'เพิ่มแท็ก…',
    pin: 'ปักหมุด',
    unpin: 'เลิกปักหมุด',
    delete: 'ลบ',
    deleteConfirm: 'ลบโน้ตนี้หรือไม่? ไม่สามารถย้อนกลับได้',
    emptyTitle: 'ยังไม่มีโน้ต',
    emptySub: 'สร้างโน้ตแรกเพื่อจดไอเดียและสรุปบทเรียน',
    noMatches: 'ไม่มีโน้ตที่ตรงกับตัวกรอง',
    back: 'กลับ',
  },
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: 0 errors — `en` and `th` must be structurally identical (the `I18n` type is derived from `en`, so any missing `th` key fails here).

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat(notes): i18n strings for notes nav + pages (en + th)"
```

---

### Task 6: `/notes` list page

**Files:**
- Create: `src/routes/(app)/notes/+page.svelte`

**Interfaces:**
- Consumes: `notes` store + `loadData` (Task 2), `filterNotes` (Task 3), `subjects` store, `t`/`settings` i18n (Task 5), `newId`.
- Produces: route `/notes`; the "+ New" action navigates to `/notes/<newId()>`.

- [ ] **Step 1: Create the page**

Create `src/routes/(app)/notes/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
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
    return $subjects.find((s) => s.id === id)?.name ?? t('notes.unfiled', $settings.lang);
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
    <h1>{t('notes.title', $settings.lang)}</h1>
    <button class="new-btn" on:click={newNote}>+ {t('notes.newNote', $settings.lang)}</button>
  </header>

  <input
    class="search"
    type="search"
    bind:value={query}
    placeholder={t('notes.searchPlaceholder', $settings.lang)}
    aria-label={t('notes.searchPlaceholder', $settings.lang)}
  />

  <div class="chips" role="group" aria-label="Subject filter">
    <button class="chip" class:active={subjectFilter === undefined} on:click={() => (subjectFilter = undefined)}>{t('notes.allSubjects', $settings.lang)}</button>
    {#each subjectsWithNotes as s (s.id)}
      <button class="chip" class:active={subjectFilter === s.id} on:click={() => (subjectFilter = s.id)}>{s.name}</button>
    {/each}
    {#if hasUnfiled}
      <button class="chip" class:active={subjectFilter === null} on:click={() => (subjectFilter = null)}>{t('notes.unfiled', $settings.lang)}</button>
    {/if}
  </div>

  {#if allTags.length}
    <div class="chips" role="group" aria-label="Tag filter">
      <button class="chip" class:active={tagFilter === null} on:click={() => (tagFilter = null)}>{t('notes.allTags', $settings.lang)}</button>
      {#each allTags as tag (tag)}
        <button class="chip" class:active={tagFilter === tag} on:click={() => (tagFilter = tag)}>#{tag}</button>
      {/each}
    </div>
  {/if}

  {#if $notes.length === 0}
    <div class="empty-state">
      <p class="empty-title">{t('notes.emptyTitle', $settings.lang)}</p>
      <p class="empty-sub">{t('notes.emptySub', $settings.lang)}</p>
    </div>
  {:else if visible.length === 0}
    <div class="empty-state">
      <p class="empty-title">{t('notes.noMatches', $settings.lang)}</p>
    </div>
  {:else}
    <ul class="note-list">
      {#each visible as note (note.id)}
        <li>
          <a class="note-row" href={`/notes/${note.id}`}>
            <div class="row-main">
              <span class="row-title">
                {#if note.pinned}<span class="pin-dot" aria-hidden="true">📌</span>{/if}
                {note.title || t('notes.titlePlaceholder', $settings.lang)}
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
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Browser-verify (guest mode)**

Start the dev server, open `/notes` as a guest. Expect the empty state ("No notes yet."). Confirm "+ New" navigates to `/notes/<id>` (editor lands in Task 7 — for now an empty route is expected; verify navigation occurs and the URL has a fresh id). EN + TH, mobile (390px) + desktop.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/notes/+page.svelte"
git commit -m "feat(notes): /notes list page with search + subject + tag filters"
```

---

### Task 7: `/notes/[id]` autosaving editor

**Files:**
- Create: `src/routes/(app)/notes/[id]/+page.svelte`

**Interfaces:**
- Consumes: `notes` store + `loadData` (Task 2), `notesRepo` (Task 2), `normalizeTags` (Task 3), `renderMarkdown` (Task 4), `subjects` store, `getAuthContext` (`$lib/data/authctx` re-exported from `$lib/stores/data`), `Picker` + `ConfirmDialog` components, i18n (Task 5).
- Produces: route `/notes/[id]`. Autosave: debounced ~800ms, flushed on `beforeNavigate` + `pagehide`. A note left entirely blank (no title, body, or tags) and never persisted is discarded on leave.

- [ ] **Step 1: Create the editor page**

Create `src/routes/(app)/notes/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import { goto, beforeNavigate } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { settings } from '$lib/stores/settings';
  import { loadData, notes, subjects, getAuthContext } from '$lib/stores/data';
  import { notesRepo } from '$lib/data/entities';
  import { normalizeTags } from '$lib/notes';
  import { renderMarkdown } from '$lib/markdown';
  import Picker from '$lib/components/Picker.svelte';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { t } from '$lib/i18n';
  import type { Note } from '$lib/types';

  const SAVE_DEBOUNCE_MS = 800;

  $: id = $page.params.id;

  let title = '';
  let body = '';
  let tags: string[] = [];
  let subjectId: string | undefined = undefined;
  let pinned = false;
  let createdAt = '';
  let mode: 'write' | 'preview' = 'write';
  let previewHtml = '';
  let tagDraft = '';
  let confirmDelete = false;

  let loaded = false;     // initial value hydrated
  let persisted = false;  // has been written to the repo at least once
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
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
    loaded = true;
  });

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
    if (isBlank()) return;          // never persist an empty note
    await notesRepo.save(buildNote());
    persisted = true;
  }

  function scheduleSave() {
    if (!loaded) return;            // ignore changes during hydration
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flush(); }, SAVE_DEBOUNCE_MS);
  }

  // Any tracked field change schedules a save.
  $: if (loaded) { title; body; tags; subjectId; pinned; scheduleSave(); }

  async function showPreview() {
    mode = 'preview';
    previewHtml = await renderMarkdown(body);
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
    if (persisted) await notesRepo.remove(id);
    persisted = true; // prevent the leave-flush from re-saving
    goto('/notes');
  }

  // Flush (or discard) before leaving the route and on tab suspension.
  beforeNavigate(() => { void flush(); });
  function onPageHide() { void flush(); }
  onMount(() => {
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('visibilitychange', onPageHide);
  });
  onDestroy(() => {
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('visibilitychange', onPageHide);
    if (saveTimer) clearTimeout(saveTimer);
  });
</script>

<div class="editor">
  <header class="editor-bar">
    <a class="back" href="/notes" aria-label={t('notes.back', $settings.lang)}>‹ {t('notes.back', $settings.lang)}</a>
    <div class="bar-actions">
      <button class="pin-toggle" class:on={pinned} on:click={() => (pinned = !pinned)}>
        {pinned ? t('notes.unpin', $settings.lang) : t('notes.pin', $settings.lang)}
      </button>
      <button class="delete-btn" on:click={() => (confirmDelete = true)}>{t('notes.delete', $settings.lang)}</button>
    </div>
  </header>

  <input
    class="title-input"
    bind:value={title}
    placeholder={t('notes.titlePlaceholder', $settings.lang)}
    aria-label={t('notes.titlePlaceholder', $settings.lang)}
  />

  <div class="meta-row">
    <Picker
      value={subjectId ?? ''}
      options={subjectOptions}
      placeholder={t('notes.unfiled', $settings.lang)}
      ariaLabel={t('notes.unfiled', $settings.lang)}
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
      on:keydown={onTagKey}
      on:blur={addTag}
      placeholder={t('notes.tagsPlaceholder', $settings.lang)}
      aria-label={t('notes.tagsPlaceholder', $settings.lang)}
    />
  </div>

  <div class="mode-toggle" role="tablist">
    <button role="tab" aria-selected={mode === 'write'} class:active={mode === 'write'} on:click={() => (mode = 'write')}>{t('notes.write', $settings.lang)}</button>
    <button role="tab" aria-selected={mode === 'preview'} class:active={mode === 'preview'} on:click={showPreview}>{t('notes.preview', $settings.lang)}</button>
  </div>

  {#if mode === 'write'}
    <textarea
      class="body-input"
      bind:value={body}
      placeholder={t('notes.bodyPlaceholder', $settings.lang)}
      aria-label={t('notes.bodyPlaceholder', $settings.lang)}
    ></textarea>
  {:else}
    <!-- previewHtml is sanitized by renderMarkdown (DOMPurify) -->
    <div class="body-preview markdown">{@html previewHtml}</div>
  {/if}
</div>

<ConfirmDialog
  open={confirmDelete}
  message={t('notes.deleteConfirm', $settings.lang)}
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
  .mode-toggle { display: inline-flex; gap: 2px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 2px; width: max-content; }
  .mode-toggle button { padding: 6px 16px; border: none; border-radius: calc(var(--radius-md) - 2px); background: transparent; color: var(--muted); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; }
  .mode-toggle button.active { background: var(--bg); color: var(--text); }
  .body-input { flex: 1; min-height: 320px; width: 100%; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); color: var(--text); font-size: 15px; line-height: 1.6; font-family: var(--font-mono); padding: 14px; resize: vertical; }
  .body-input:focus { outline: none; border-color: var(--primary); }
  .body-preview { flex: 1; min-height: 320px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); color: var(--text); padding: 14px; font-size: 15px; line-height: 1.6; }
  .markdown :global(h1) { font-size: 22px; font-weight: 700; margin: 0.6em 0 0.3em; }
  .markdown :global(h2) { font-size: 18px; font-weight: 700; margin: 0.6em 0 0.3em; }
  .markdown :global(ul), .markdown :global(ol) { padding-left: 1.4em; }
  .markdown :global(code) { font-family: var(--font-mono); background: var(--bg3); padding: 1px 4px; border-radius: 4px; }
  .markdown :global(a) { color: var(--primary); }
</style>
```

> Implementation notes for Codex:
> - Verify `ConfirmDialog`'s actual prop/event API (`open`, `message`, `confirm`/`cancel` events) against `src/lib/components/ConfirmDialog.svelte` and adjust the binding if it differs.
> - Verify the `Subject` type exposes `color` (used for the Picker option dot); if not, drop `color` from `subjectOptions`.
> - `getAuthContext()` is re-exported from `$lib/stores/data`.

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: 0 errors. (Resolve any `ConfirmDialog`/`Subject.color` mismatch flagged above before moving on.)

- [ ] **Step 3: Browser-verify (guest mode)**

Dev server, guest. From `/notes` click "+ New": editor opens blank. Type a title + body → wait ~1s → reload the page → content persists (autosave wrote to `localStorage['pulse.notes']`). Add/remove tags, set a subject, toggle pin. Open a second "+ New" and leave it completely blank → navigate back → confirm no empty row was created in the list. Switch to Preview → Markdown renders; paste `<script>alert(1)</script>` in the body → Preview shows no script executes and no raw tag. Delete via the confirm dialog → returns to `/notes`, row gone. EN + TH, mobile (390px) + desktop.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/notes/[id]/+page.svelte"
git commit -m "feat(notes): /notes/[id] full-screen markdown editor with autosave"
```

---

### Task 8: Navigation entries (Sidebar + MoreDrawer)

**Files:**
- Modify: `src/lib/components/Sidebar.svelte` (add a `notes` item to the `groupMain` items array)
- Modify: `src/lib/components/MoreDrawer.svelte` (add a `notes` item to the `items` array)

**Interfaces:**
- Consumes: `nav.notes` i18n key (Task 5); route `/notes` (Task 6).

- [ ] **Step 1: Add to the sidebar**

In `src/lib/components/Sidebar.svelte`, in the `groupMain` block's `items` array (after the `subjects` entry), add:

```typescript
      { key: 'notes',     href: '/notes',     d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h6' },
```

- [ ] **Step 2: Add to the mobile More drawer**

In `src/lib/components/MoreDrawer.svelte`, in the `items` array (a sensible place is right after `flashcards`), add:

```typescript
    { key: 'notes',      href: '/notes',      d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M8 13h8M8 17h6' },
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: 0 errors (`'notes'` is now a valid `NavKey` because Task 5 added `nav.notes`).

- [ ] **Step 4: Browser-verify**

Dev server. Desktop: "Notes" appears under the **Main** sidebar group, navigates to `/notes`, highlights when active. Mobile (390px): "Notes" appears in the More drawer and navigates correctly. EN + TH.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Sidebar.svelte src/lib/components/MoreDrawer.svelte
git commit -m "feat(notes): add Notes to sidebar (Main) and mobile More drawer"
```

---

### Task 9: Supabase migration file (created, NOT applied)

**Files:**
- Create: `supabase/migrations/20260626000000_create_notes_table.sql`

**Interfaces:**
- Produces: the `notes` table + RLS used by `notesRepo` in authenticated mode.

> **Production gate:** This task only writes the migration file. **Applying it to prod is a production action and requires explicit user go-ahead** — do not run `apply_migration` / `supabase db push` as part of executing this plan. Before creating the file, check `supabase/migrations/` for the existing timestamp-naming convention and rename to match if needed.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260626000000_create_notes_table.sql`:

```sql
create table public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_idx on public.notes (user_id);

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Commit (file only — not applied)**

```bash
git add supabase/migrations/20260626000000_create_notes_table.sql
git commit -m "feat(notes): notes table migration (RLS, subject set-null) — not yet applied"
```

- [ ] **Step 3: STOP — request go-ahead**

Surface to the user: the migration file is committed but **not applied**. Ask for explicit go-ahead before applying it to prod. Only after the table exists can authenticated-mode browser-verify (Supabase round-trip + RLS isolation) be completed; guest-mode verification (Tasks 6–7) does not require it.

---

## Final Verification (after all tasks)

- [ ] `npm run check` — 0 errors.
- [ ] `npx vitest run` — all green (mapper round-trip, `normalizeTags`/`filterNotes`, `renderMarkdown` sanitization).
- [ ] Guest browser-verify (EN + TH, mobile 390px + desktop): create → edit (autosave persists across reload) → pin → search → subject/tag filter → delete; blank-abandoned note discarded; Preview renders Markdown and strips injected `<script>`.
- [ ] Authenticated browser-verify (after the migration is applied with go-ahead): same flows confirm Supabase round-trip and RLS isolation (a second account cannot see the first's notes).

## Spec Coverage Check

- Note entity + repo (dual-mode) → Tasks 1, 2.
- `notes` table + RLS migration → Task 9 (file; apply gated).
- `/notes` list (search + subject + tag filters, empty/no-match states) → Task 6.
- `/notes/[id]` editor (Markdown write/preview, autosave + flush, blank-discard, delete) → Task 7.
- Sanitized Markdown rendering (dynamic import) → Task 4.
- Nav entry (Main) + i18n (en + th) → Tasks 5, 8.
- Unit tests (mapper, markdown sanitization, filter logic) → Tasks 1, 3, 4.
- Phase 2 (group sharing) → out of scope, deferred to a separate spec.
