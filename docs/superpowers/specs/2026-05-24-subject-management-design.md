# Subject Management Design

## Goal

Let users build their subject list from curated templates or by adding custom subjects, with full edit/delete support. Templates are shared presets; subjects are per-user.

---

## Navigation

- `/subjects` — existing subjects grid + "+" button (add custom) + "Templates" link in header
- `/subjects/templates` — list of all templates (built-in + user custom) + "New template" button
- `/subjects/templates/[id]` — checklist of a template's subjects → "Add selected" button

---

## Built-in Templates (hardcoded in `constants.ts`, read-only)

### TCAS
Physics, Chemistry, Mathematics, Biology, English, Thai, TGAT1, TGAT2, TGAT3, TPAT1, TPAT2, TPAT3, TPAT4, TPAT5

### Medicine
Biology, Chemistry, Physics, Thai, English, Social Studies, TPAT1, TGAT1, TGAT2, TGAT3

### Engineering
Mathematics, Physics, Chemistry, English, TPAT3

Built-ins cannot be edited or deleted. They are available to all users (shared by being hardcoded).

---

## Custom Templates

Users can create their own templates:
- Name (required)
- List of subject names (add/remove rows)
- Stored in `localStorage` (`pulse_templates`) for guest; Supabase `templates` table for auth users
- Can be edited and deleted

---

## Types

```ts
export interface SubjectPreset {
  name: string;
  symbol: string;   // 2-char auto-derived from name, e.g. "Ph"
  color: string;    // hex
  colorRgb: string; // "r,g,b"
}

export interface Template {
  id: string;
  userId: string;      // 'builtin' for built-ins
  name: string;
  presets: SubjectPreset[];
  createdAt: string;
}
```

The `Subject` type is unchanged — subjects belong to the user, not to a template.

---

## Adding Subjects from a Template

1. User taps a template on `/subjects/templates`
2. Sees a checklist of the template's presets (all checked by default)
3. Subjects the user already has (matched by name, case-insensitive) are shown as already added and un-checkable
4. Tap "Add selected" → each checked preset is saved as a new `Subject` with `userId`, a new `id`, and order continuing from current max `orderIndex`
5. Navigate back to `/subjects`

---

## Adding a Custom Subject

On `/subjects`, tap "+" → inline bottom sheet:
- Name input (required)
- Symbol input (2 chars, auto-filled from first 2 chars of name)
- Color: 8 preset swatches (picks from a fixed palette covering the color spectrum)
- Save → `db.saveSubject` → update store

---

## Editing a Subject

Tap the pencil/edit icon on a subject tile → same sheet pre-filled → Save updates, or Delete removes.

Delete: optimistic remove from store, then `db.deleteSubject`. Also removes all topics and SRS cards for that subject (cascade handled in DB for auth; manual cleanup in guest mode).

---

## DB Changes

### `src/lib/db.ts`
Add:
- `getTemplates(userId, mode)` — returns built-ins + user's custom templates
- `saveTemplate(template, mode)` — upsert to LS/Supabase
- `deleteTemplate(templateId, mode)` — delete from LS/Supabase
- `deleteSubject(subjectId, mode)` — delete subject + its topics + srs_cards from LS/Supabase

### Supabase migration (auth users only)
```sql
create table if not exists templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  presets    jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table templates enable row level security;
create policy "users own templates" on templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## Files

| Action | Path | What |
|--------|------|------|
| Modify | `src/lib/constants.ts` | Replace `TCAS_SUBJECTS` with 3 built-in templates + helper to derive symbol/color |
| Modify | `src/lib/types.ts` | Add `SubjectPreset`, `Template` types |
| Modify | `src/lib/db.ts` | Add `getTemplates`, `saveTemplate`, `deleteTemplate`, `deleteSubject` |
| Modify | `src/lib/stores/data.ts` | Add `templates` writable, load in `loadData` |
| Modify | `src/routes/(app)/subjects/+page.svelte` | Add "+" button, edit icon on tiles, "Templates" link |
| Create | `src/routes/(app)/subjects/templates/+page.svelte` | Templates list page |
| Create | `src/routes/(app)/subjects/templates/[id]/+page.svelte` | Template checklist + add selected |
| Modify | `src/lib/i18n/en.ts` + `th.ts` | Add subject/template keys |

---

## Color Palette for Custom Subjects (8 swatches)

`#ef4444` `#f59e0b` `#22c55e` `#0d9488` `#3b82f6` `#8b5cf6` `#ec4899` `#6b7280`

---

## Out of Scope

- Cross-user template sharing (social/community templates)
- Reordering subjects (drag-to-reorder)
- Importing/exporting templates
