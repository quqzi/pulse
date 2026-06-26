# Pulse Notes — Phase 1 Design

**Date:** 2026-06-25
**Status:** Approved (design); plan + implementation to follow
**Author:** brainstormed with the user

## Goal

A standalone, dual-mode **Notes** feature for Pulse: subject-linked, tag-organized,
Markdown-bodied notes with a full-screen editor. Works fully offline in **guest**
mode (localStorage) and synced via **Supabase + RLS** when authenticated — every
data path supports both, through the existing repo engine.

Phase 2 (deferred, separate spec): add `'note'` to the existing `group_shares`
sharing layer so notes can be shared into study groups.

## Scope

**In scope (Phase 1):**
- `Note` entity + repo (dual-mode, repo engine)
- `notes` Supabase table + RLS + migration
- `/notes` list page — search + subject filter + tag filter
- `/notes/[id]` full-screen editor — Markdown write/preview, autosave
- Sanitized Markdown rendering
- Nav entry (Main group), i18n (en + th)
- Unit tests (mapper, markdown sanitization, filter logic)

**Out of scope (Phase 2+):** sharing notes into groups, note folders/notebooks,
attachments/images, collaborative editing, version history, export.

## Data Model

```ts
// src/lib/types.ts
export interface Note {
  id: string;
  userId: string;
  subjectId?: string;   // optional FK → subject; unset = "Unfiled"
  title: string;
  body: string;         // Markdown source text
  tags: string[];       // free-text tags, lowercased + de-duped on save
  pinned: boolean;
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp — bumped on every save; drives list sort
}
```

- `subjectId` is optional. Notes with no subject render under "Unfiled".
- `tags` is a string array. Normalized on save: trimmed, lowercased, empties
  removed, de-duplicated.
- `updatedAt` is set to `new Date().toISOString()` on every save (create + update).
- DB columns are snake_case; TS fields camelCase — mapper pair required.

## Storage — dual-mode via the repo engine

One `repo()` call, bound to the `notes` store. The engine handles the mode switch;
callers never branch on mode.

```ts
// src/lib/data/entities.ts
export const notesRepo = repo<Note>({
  store: notes,
  lsKey: 'pulse.notes',          // DOT namespace
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

- **Guest:** `localStorage['pulse.notes']`
- **Authenticated:** Supabase `notes` table, RLS `auth.uid() = user_id`
- Errors are caught in the engine and surfaced via `toast.error` — no try/catch in pages.

### Migration (production action — requires explicit user go-ahead before applying)

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

- `subject_id ... on delete set null` — deleting a subject **unlinks** notes (moves
  them to "Unfiled"); it never deletes the note.
- `user_id ... on delete cascade` — deleting an account removes its notes.

## Markdown Rendering

`src/lib/markdown.ts` exports a single sanitizing renderer:

```ts
// renderMarkdown(md: string): Promise<string>  — returns sanitized HTML
```

- Uses **`marked`** (Markdown → HTML) + **`DOMPurify`** (sanitize) to strip
  `<script>`, inline event handlers, `javascript:` URLs, etc.
- **Sanitization is mandatory** — Phase 2 shares note bodies into groups, so
  untrusted Markdown must never render raw HTML.
- Both libraries are **dynamically imported** inside `renderMarkdown` so they
  code-split onto the notes route only and don't inflate the main bundle
  (keeps within the app-page JS budget).
- Markdown is rendered client-side only (preview pane + future note view).

## Pages

### `/notes` — list (`src/routes/(app)/notes/+page.svelte`)

- `onMount` → `loadData($auth)`; `$: if ($auth.mode !== 'loading') loadData($auth)`.
- **Controls:**
  - Search box — matches title + body (case-insensitive substring).
  - Subject filter chips — "All" + one chip per subject that has notes + "Unfiled"
    if any unlinked notes exist.
  - Tag filter chips — derived from the union of all tags on the user's notes.
- **List:** filtered + sorted (pinned first, then `updatedAt` desc). Each row:
  pin indicator, title, one-line body snippet, subject dot/name, tag badges.
- **"+ New":** generates `newId()` and navigates to `/notes/<id>` with a blank
  editor (see editor autosave for persistence semantics).
- **Empty state:** the standard CLAUDE.md empty-state block ("No notes yet." /
  hint) when the user has zero notes; a distinct "No matches" message when filters
  exclude everything.

### `/notes/[id]` — editor (`src/routes/(app)/notes/[id]/+page.svelte`)

- Full-screen. Back button returns to `/notes`.
- Controls: title input, `[Write | Preview]` toggle, Markdown textarea (Write) /
  sanitized rendered HTML (Preview), subject picker (existing `Picker` component),
  tag input (add/remove chips), pin toggle, delete button.
- **Autosave:** debounced ~800ms after any change; also flushed on `pagehide` and
  on navigating back — mirroring the existing settings-flush pattern. Each save
  bumps `updatedAt` and calls `notesRepo.save(note)` (write-through; the bound
  store updates — never `.set()` it manually).
- **New-note semantics:** a freshly created note is only persisted once the first
  autosave fires after the user types a title or body. A note left entirely blank
  (no title, no body, no tags) and abandoned is **not** persisted / is discarded
  on leave — no empty rows accumulate.
- **Delete:** confirm via the existing `ConfirmDialog`, then `notesRepo.remove(id)`
  and navigate back to `/notes`.

## Supporting modules

- `src/lib/notes.ts` — a **pure** `filterNotes(notes, { query, subjectId, tag })`
  helper that returns the filtered, sorted list. Pure so it's unit-testable
  independent of Svelte.
- `src/lib/data/mappers.ts` — `noteFromRow` / `noteToRow` (snake ↔ camel; `tags`
  maps Postgres `text[]` ↔ `string[]`).
- `src/lib/data/stores.ts` — `export const notes = writable<Note[]>([])`.
- `src/lib/stores/data.ts` — re-export `notes`; add `notesRepo.load()` to
  `loadData`'s `Promise.all`.

## Navigation

- **Main** group (next to Subjects) in `src/lib/components/Sidebar.svelte`
  (`{ label, href: '/notes', d: '<SVG path d>' }`) and the mobile
  `src/lib/components/MoreDrawer.svelte`.
- i18n keys for the nav label + page strings in **both** `src/lib/i18n/en.ts`
  and `src/lib/i18n/th.ts`.

## Error Handling

- Repo engine catches persistence errors → `toast.error`. No try/catch in pages.
- No loading spinners (stores start empty and fill fast). No explicit error states.
- `renderMarkdown` failures (malformed input) degrade to escaped plain text rather
  than throwing.

## Testing

Vitest (unit):
- `noteFromRow` / `noteToRow` round-trip, including `tags` array and optional
  `subjectId` (null ↔ undefined).
- `renderMarkdown` strips `<script>`, inline `on*=` handlers, and `javascript:`
  URLs while preserving headings/bold/lists.
- `filterNotes` — search substring, subject filter, tag filter, combined filters,
  and pinned-first / updatedAt-desc ordering.

Browser-verify (manual, per the default loop):
- Guest mode: create, edit (autosave persists across reload), pin, filter, search,
  delete; EN + TH; mobile (390px) + desktop.
- Authenticated mode: same, confirming Supabase round-trip and RLS isolation.

## Phase 2 (deferred — separate spec)

Add `'note'` to the `group_shares` `kind` union (`src/lib/groups.ts`) and a
snapshot share/import path, reusing the existing sharing UI (Shared tab,
"Add to my account"). Notes shared are snapshots, consistent with the
flashcard-deck / exam-set sharing model. Not built in Phase 1.
