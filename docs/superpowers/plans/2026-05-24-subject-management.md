# Subject Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create subjects from curated templates or add custom ones, with full edit/delete support.

**Architecture:** Built-in templates are hardcoded in `constants.ts` (read-only, shared to all users). User-created custom templates live in localStorage/Supabase. The `templates` writable store holds only custom templates; built-ins are imported directly in UI. Subjects are unchanged — they're per-user, sourced from any template or added manually.

**Tech Stack:** SvelteKit 2, TypeScript, Supabase JS v2, plain CSS custom properties

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/types.ts` | Add `SubjectPreset`, `Template` types |
| Modify | `src/lib/constants.ts` | Replace `TCAS_SUBJECTS` with `BUILTIN_TEMPLATES` + `SUBJECT_COLOR_PALETTE` |
| Modify | `src/lib/db.ts` | Update `seedSubjectsFromNames`; add `getTemplates`, `saveTemplate`, `deleteTemplate`, `deleteSubject` |
| Modify | `src/lib/stores/data.ts` | Add `templates` writable, load custom templates in `loadData` |
| Modify | `src/routes/(app)/subjects/+page.svelte` | Add "+" button, edit icons, "Templates" link, add/edit sheet |
| Create | `src/routes/(app)/subjects/templates/+page.svelte` | Templates list + create custom template |
| Create | `src/routes/(app)/subjects/templates/[id]/+page.svelte` | Template checklist + "Add selected" |
| Modify | `src/lib/i18n/en.ts` | Add `subjects.templates` namespace |
| Modify | `src/lib/i18n/th.ts` | Add `subjects.templates` Thai strings |

---

### Task 1: Types + Constants + fix seedSubjectsFromNames

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/db.ts` (seedSubjectsFromNames only)

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Read the file, then append after the last export:

```ts
export interface SubjectPreset {
  name: string;
  symbol: string;
  color: string;
  colorRgb: string;
}

export interface Template {
  id: string;
  userId: string;  // 'builtin' for built-ins
  name: string;
  presets: SubjectPreset[];
  createdAt: string;
}
```

- [ ] **Step 2: Replace `src/lib/constants.ts` entirely**

```ts
import type { SubjectPreset, Template } from '$lib/types';

export const SUBJECT_COLOR_PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#ef4444', rgb: '239,68,68'   },
  { hex: '#f59e0b', rgb: '245,158,11'  },
  { hex: '#22c55e', rgb: '34,197,94'   },
  { hex: '#0d9488', rgb: '13,148,136'  },
  { hex: '#3b82f6', rgb: '59,130,246'  },
  { hex: '#8b5cf6', rgb: '139,92,246'  },
  { hex: '#ec4899', rgb: '236,72,153'  },
  { hex: '#6b7280', rgb: '107,114,128' },
];

function p(name: string, symbol: string, color: string, colorRgb: string): SubjectPreset {
  return { name, symbol, color, colorRgb };
}

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'builtin-tcas',
    userId: 'builtin',
    name: 'TCAS',
    createdAt: '2026-01-01T00:00:00.000Z',
    presets: [
      p('Physics',     'Ph', '#0d9488', '13,148,136'),
      p('Chemistry',   'Ch', '#d97706', '217,119,6'),
      p('Mathematics', 'Ma', '#3b82f6', '59,130,246'),
      p('Biology',     'Bi', '#22c55e', '34,197,94'),
      p('English',     'En', '#f43f5e', '244,63,94'),
      p('Thai',        'Th', '#8b5cf6', '139,92,246'),
      p('TGAT1',       'G1', '#0ea5e9', '14,165,233'),
      p('TGAT2',       'G2', '#0284c7', '2,132,199'),
      p('TGAT3',       'G3', '#0369a1', '3,105,161'),
      p('TPAT1',       'P1', '#ec4899', '236,72,153'),
      p('TPAT2',       'P2', '#db2777', '219,39,119'),
      p('TPAT3',       'P3', '#f97316', '249,115,22'),
      p('TPAT4',       'P4', '#ea580c', '234,88,12'),
      p('TPAT5',       'P5', '#dc2626', '220,38,38'),
    ],
  },
  {
    id: 'builtin-medicine',
    userId: 'builtin',
    name: 'Medicine',
    createdAt: '2026-01-01T00:00:00.000Z',
    presets: [
      p('Biology',        'Bi', '#22c55e', '34,197,94'),
      p('Chemistry',      'Ch', '#d97706', '217,119,6'),
      p('Physics',        'Ph', '#0d9488', '13,148,136'),
      p('Thai',           'Th', '#8b5cf6', '139,92,246'),
      p('English',        'En', '#f43f5e', '244,63,94'),
      p('Social Studies', 'So', '#6b7280', '107,114,128'),
      p('TPAT1',          'P1', '#ec4899', '236,72,153'),
      p('TGAT1',          'G1', '#0ea5e9', '14,165,233'),
      p('TGAT2',          'G2', '#0284c7', '2,132,199'),
      p('TGAT3',          'G3', '#0369a1', '3,105,161'),
    ],
  },
  {
    id: 'builtin-engineering',
    userId: 'builtin',
    name: 'Engineering',
    createdAt: '2026-01-01T00:00:00.000Z',
    presets: [
      p('Mathematics', 'Ma', '#3b82f6', '59,130,246'),
      p('Physics',     'Ph', '#0d9488', '13,148,136'),
      p('Chemistry',   'Ch', '#d97706', '217,119,6'),
      p('English',     'En', '#f43f5e', '244,63,94'),
      p('TPAT3',       'P3', '#f97316', '249,115,22'),
    ],
  },
];

// Flat preset lookup used by seedSubjectsFromNames in db.ts
export const ALL_BUILTIN_PRESETS = new Map(
  BUILTIN_TEMPLATES.flatMap(t => t.presets).map(p => [p.name.toLowerCase(), p])
);
```

- [ ] **Step 3: Update `seedSubjectsFromNames` in `src/lib/db.ts`**

Find the existing import at the top of `db.ts`:
```ts
import { TCAS_SUBJECTS } from '$lib/constants';
```

Replace it with:
```ts
import { ALL_BUILTIN_PRESETS } from '$lib/constants';
```

Then find the `seedSubjectsFromNames` function and replace it:
```ts
function seedSubjectsFromNames(names: string[]): Subject[] {
  const result: Subject[] = names.map((name, i) => {
    const preset = ALL_BUILTIN_PRESETS.get(name.toLowerCase());
    return {
      id: newId(),
      userId: 'guest',
      name,
      symbol: preset?.symbol ?? name.slice(0, 2),
      color: preset?.color ?? '#6366f1',
      colorRgb: preset?.colorRgb ?? '99,102,241',
      orderIndex: i,
    };
  });
  lsSet('pulse_subjects', result);
  return result;
}
```

- [ ] **Step 4: Run type check**

```powershell
cd C:\Users\HP\Documents\pulse
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/types.ts src/lib/constants.ts src/lib/db.ts
git commit -m "feat: add SubjectPreset/Template types and built-in template constants"
```

---

### Task 2: DB CRUD — templates + deleteSubject

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add `Template` to the import from `$lib/types`**

Find:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task } from '$lib/types';
```
Replace with:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template, SubjectPreset } from '$lib/types';
```

- [ ] **Step 2: Add `mapTemplateFromDb` after `mapTaskFromDb`**

```ts
function mapTemplateFromDb(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    presets: row.presets as SubjectPreset[],
    createdAt: row.created_at as string,
  };
}
```

- [ ] **Step 3: Add four methods inside `export const db = { ... }` before `newId,`**

```ts
  // ── TEMPLATES ─────────────────────────────────────────────
  async getTemplates(userId: string, mode: Mode): Promise<Template[]> {
    if (mode === 'guest') return lsGet<Template>('pulse_templates');
    const { data } = await supabase.from('templates').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(mapTemplateFromDb);
  },

  async saveTemplate(template: Template, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<Template>('pulse_templates');
      const idx = all.findIndex(t => t.id === template.id);
      if (idx >= 0) all[idx] = template; else all.push(template);
      lsSet('pulse_templates', all);
      return;
    }
    await supabase.from('templates').upsert({
      id: template.id,
      user_id: template.userId,
      name: template.name,
      presets: template.presets,
      created_at: template.createdAt,
    });
  },

  async deleteTemplate(templateId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_templates', lsGet<Template>('pulse_templates').filter(t => t.id !== templateId));
      return;
    }
    await supabase.from('templates').delete().eq('id', templateId);
  },

  async deleteSubject(subjectId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const allTopics = lsGet<Topic>('pulse_topics');
      const topicIds = new Set(allTopics.filter(t => t.subjectId === subjectId).map(t => t.id));
      lsSet('pulse_topics', allTopics.filter(t => t.subjectId !== subjectId));
      lsSet('pulse_srs_cards', lsGet<SrsCard>('pulse_srs_cards').filter(c => !topicIds.has(c.topicId)));
      lsSet('pulse_subjects', lsGet<Subject>('pulse_subjects').filter(s => s.id !== subjectId));
      return;
    }
    // topics + srs_cards cascade-delete in Supabase via FK constraints
    await supabase.from('subjects').delete().eq('id', subjectId);
  },
```

- [ ] **Step 4: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/db.ts
git commit -m "feat: add template and deleteSubject db methods"
```

---

### Task 3: Add `templates` store

**Files:**
- Modify: `src/lib/stores/data.ts`

- [ ] **Step 1: Update `src/lib/stores/data.ts`**

Read the file, then make these changes:

Add `Template` to the types import:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template } from '$lib/types';
```

Add the writable after `export const tasks = writable<Task[]>([]);`:
```ts
export const templates = writable<Template[]>([]);
```

Update `loadData` — replace the `const [s, t, c, sess, tsk]` block:
```ts
  const [s, t, c, sess, tsk, tmpl] = await Promise.all([
    db.getSubjects(_userId, _mode),
    db.getTopics(_userId, _mode),
    db.getSrsCards(_userId, _mode),
    db.getSessions(_userId, _mode),
    db.getTasks(_userId, _mode),
    db.getTemplates(_userId, _mode),
  ]);
  subjects.set(s);
  topics.set(t);
  srsCards.set(c);
  sessions.set(sess);
  tasks.set(tsk);
  templates.set(tmpl);
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/stores/data.ts
git commit -m "feat: add templates store and load in loadData"
```

---

### Task 4: Update Subjects page — add "+" button, edit icons, add/edit sheet

**Files:**
- Modify: `src/routes/(app)/subjects/+page.svelte`

- [ ] **Step 1: Replace the entire file**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, topics, srsCards, dueCards, loadData, getAuthContext } from '$lib/stores/data';
  import SubjectTile from '$lib/components/SubjectTile.svelte';
  import { db } from '$lib/db';
  import { SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import type { Subject } from '$lib/types';

  onMount(() => loadData($auth));

  $: dueBySubject = (subjectId: string) => {
    const subjectTopicIds = new Set($topics.filter(t => t.subjectId === subjectId).map(t => t.id));
    return $dueCards.filter(c => subjectTopicIds.has(c.topicId)).length;
  };

  let sheetOpen = false;
  let editingSubject: Subject | null = null;
  let sheetName = '';
  let sheetSymbol = '';
  let sheetColor = SUBJECT_COLOR_PALETTE[0];

  function openAdd() {
    editingSubject = null;
    sheetName = '';
    sheetSymbol = '';
    sheetColor = SUBJECT_COLOR_PALETTE[0];
    sheetOpen = true;
  }

  function openEdit(subject: Subject) {
    editingSubject = subject;
    sheetName = subject.name;
    sheetSymbol = subject.symbol;
    sheetColor = SUBJECT_COLOR_PALETTE.find(c => c.hex === subject.color) ?? { hex: subject.color, rgb: subject.colorRgb };
    sheetOpen = true;
  }

  function closeSheet() { sheetOpen = false; }

  $: if (sheetName && !editingSubject) {
    sheetSymbol = sheetName.replace(/\s+/g, '').slice(0, 2);
  }

  async function saveSubject() {
    if (!sheetName.trim()) return;
    const { userId, mode } = getAuthContext();
    if (editingSubject) {
      const updated: Subject = {
        ...editingSubject,
        name: sheetName.trim(),
        symbol: (sheetSymbol || sheetName.slice(0, 2)).slice(0, 2),
        color: sheetColor.hex,
        colorRgb: sheetColor.rgb,
      };
      subjects.update(all => all.map(s => s.id === updated.id ? updated : s));
      await db.saveSubject(updated, mode);
    } else {
      const maxOrder = $subjects.reduce((m, s) => Math.max(m, s.orderIndex), -1);
      const subject: Subject = {
        id: db.newId(),
        userId,
        name: sheetName.trim(),
        symbol: (sheetSymbol || sheetName.slice(0, 2)).slice(0, 2),
        color: sheetColor.hex,
        colorRgb: sheetColor.rgb,
        orderIndex: maxOrder + 1,
      };
      subjects.update(all => [...all, subject]);
      await db.saveSubject(subject, mode);
    }
    closeSheet();
  }

  async function deleteSubject() {
    if (!editingSubject) return;
    const { mode } = getAuthContext();
    const id = editingSubject.id;
    const removedTopicIds = new Set($topics.filter(t => t.subjectId === id).map(t => t.id));
    subjects.update(all => all.filter(s => s.id !== id));
    topics.update(all => all.filter(t => t.subjectId !== id));
    srsCards.update(all => all.filter(c => !removedTopicIds.has(c.topicId)));
    closeSheet();
    await db.deleteSubject(id, mode);
  }
</script>

<div class="page">
  <div class="header-row">
    <h1 class="text-large-title">Subjects</h1>
    <div class="header-actions">
      <a href="/subjects/templates" class="templates-link">Templates</a>
      <button class="add-btn" on:click={openAdd} aria-label="Add subject">+</button>
    </div>
  </div>

  {#if $subjects.length === 0}
    <div class="empty-state">
      <p class="text-body empty">No subjects yet.</p>
      <a href="/subjects/templates" class="btn-primary-link">Browse templates</a>
    </div>
  {:else}
    <div class="subjects-grid">
      {#each $subjects as subject (subject.id)}
        <div class="tile-wrapper">
          <SubjectTile
            {subject}
            topics={$topics}
            cards={$srsCards}
            on:click={() => goto(`/subjects/${subject.id}`)}
          />
          {#if dueBySubject(subject.id) > 0}
            <div class="due-badge" style="background: {subject.color};">
              {dueBySubject(subject.id)}
            </div>
          {/if}
          <button class="edit-btn" on:click|stopPropagation={() => openEdit(subject)} aria-label="Edit subject">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if sheetOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="sheet-overlay" on:click={closeSheet} role="presentation"></div>
  <div class="sheet">
    <div class="sheet-handle"></div>
    <p class="sheet-title">{editingSubject ? 'Edit Subject' : 'New Subject'}</p>

    <div class="field">
      <label class="field-label">Name</label>
      <input class="field-input" bind:value={sheetName} placeholder="e.g. Physics" />
    </div>

    <div class="field">
      <label class="field-label">Symbol <span class="field-hint">(2 chars)</span></label>
      <input class="field-input sym-input" bind:value={sheetSymbol} maxlength="2" placeholder="Ph" />
    </div>

    <div class="field">
      <label class="field-label">Color</label>
      <div class="color-swatches">
        {#each SUBJECT_COLOR_PALETTE as c}
          <button
            class="swatch"
            class:selected={sheetColor.hex === c.hex}
            style="background:{c.hex}"
            on:click={() => sheetColor = c}
            aria-label={c.hex}
          ></button>
        {/each}
      </div>
    </div>

    <div class="sheet-actions">
      {#if editingSubject}
        <button class="btn-delete" on:click={deleteSubject}>Delete</button>
      {/if}
      <button class="btn-cancel" on:click={closeSheet}>Cancel</button>
      <button class="btn-save" on:click={saveSubject} disabled={!sheetName.trim()}>Save</button>
    </div>
  </div>
{/if}

<style>
  .page { padding: 24px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .header-actions { display: flex; align-items: center; gap: 12px; }
  .templates-link { font-size: 14px; font-weight: 600; color: var(--primary); text-decoration: none; }
  .add-btn {
    width: 32px; height: 32px; border-radius: 50%; border: none;
    background: var(--primary); color: var(--bg);
    font-size: 20px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center;
  }

  .empty-state { text-align: center; padding: 48px 0; }
  .empty { color: var(--muted); margin-bottom: 16px; }
  .btn-primary-link {
    display: inline-block; padding: 10px 20px; border-radius: var(--radius-md);
    background: var(--primary); color: var(--bg); font-size: 14px; font-weight: 600;
    text-decoration: none;
  }

  .subjects-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (min-width: 480px) { .subjects-grid { grid-template-columns: repeat(4, 1fr); } }

  .tile-wrapper { position: relative; }
  .due-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 18px; height: 18px; border-radius: 9px;
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px; pointer-events: none;
  }
  .edit-btn {
    position: absolute; bottom: -4px; right: -4px;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--bg2); border: 1px solid var(--border);
    color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 120ms ease;
  }
  .tile-wrapper:hover .edit-btn { opacity: 1; }

  /* sheet */
  .sheet-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200;
  }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    background: var(--bg2); border-radius: 20px 20px 0 0;
    padding: 12px 20px 40px; max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
  .field { margin-bottom: 16px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .field-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid var(--border);
    border-radius: var(--radius-md); background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--primary); }
  .sym-input { width: 72px; text-align: center; font-weight: 700; }
  .color-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .swatch {
    width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid transparent;
    cursor: pointer; transition: transform 100ms ease;
  }
  .swatch.selected { border-color: var(--text); transform: scale(1.15); }
  .sheet-actions { display: flex; gap: 8px; margin-top: 24px; }
  .btn-delete {
    padding: 10px 16px; border-radius: var(--radius-md); border: none;
    background: #fee2e2; color: #dc2626; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-cancel {
    flex: 1; padding: 10px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .btn-save {
    flex: 2; padding: 10px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```powershell
git add 'src/routes/(app)/subjects/+page.svelte'
git commit -m "feat: add subject add/edit sheet and Templates link to Subjects page"
```

---

### Task 5: Templates list page

**Files:**
- Create: `src/routes/(app)/subjects/templates/+page.svelte`

- [ ] **Step 1: Create the file**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { templates, loadData, getAuthContext } from '$lib/stores/data';
  import { BUILTIN_TEMPLATES, SUBJECT_COLOR_PALETTE } from '$lib/constants';
  import { db } from '$lib/db';
  import type { Template, SubjectPreset } from '$lib/types';

  onMount(() => loadData($auth));

  let creating = false;
  let newName = '';
  let newPresets: SubjectPreset[] = [];
  let newSubjectName = '';

  function addPresetRow() {
    const name = newSubjectName.trim();
    if (!name) return;
    const color = SUBJECT_COLOR_PALETTE[newPresets.length % SUBJECT_COLOR_PALETTE.length];
    newPresets = [...newPresets, { name, symbol: name.replace(/\s+/g, '').slice(0, 2), color: color.hex, colorRgb: color.rgb }];
    newSubjectName = '';
  }

  function removePreset(i: number) {
    newPresets = newPresets.filter((_, idx) => idx !== i);
  }

  function handlePresetKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); addPresetRow(); }
  }

  async function saveTemplate() {
    if (!newName.trim() || newPresets.length === 0) return;
    const { userId, mode } = getAuthContext();
    const template: Template = {
      id: db.newId(),
      userId,
      name: newName.trim(),
      presets: newPresets,
      createdAt: new Date().toISOString(),
    };
    templates.update(all => [...all, template]);
    await db.saveTemplate(template, mode);
    creating = false;
    newName = '';
    newPresets = [];
  }

  async function deleteTemplate(template: Template) {
    const { mode } = getAuthContext();
    templates.update(all => all.filter(t => t.id !== template.id));
    await db.deleteTemplate(template.id, mode);
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <button class="back-btn" on:click={() => goto('/subjects')} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <h1 class="text-large-title">Templates</h1>
  </div>

  <p class="section-label">BUILT-IN</p>
  <div class="template-list">
    {#each BUILTIN_TEMPLATES as t}
      <a href="/subjects/templates/{t.id}" class="template-row card">
        <div class="template-info">
          <span class="template-name">{t.name}</span>
          <span class="template-count">{t.presets.length} subjects</span>
        </div>
        <div class="preview-dots">
          {#each t.presets.slice(0, 5) as p}
            <span class="dot" style="background:{p.color}"></span>
          {/each}
          {#if t.presets.length > 5}
            <span class="dot-more">+{t.presets.length - 5}</span>
          {/if}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </a>
    {/each}
  </div>

  {#if $templates.length > 0}
    <p class="section-label" style="margin-top:20px">CUSTOM</p>
    <div class="template-list">
      {#each $templates as t}
        <div class="template-row card custom-row">
          <a href="/subjects/templates/{t.id}" class="template-link">
            <div class="template-info">
              <span class="template-name">{t.name}</span>
              <span class="template-count">{t.presets.length} subjects</span>
            </div>
          </a>
          <button class="delete-tpl-btn" on:click={() => deleteTemplate(t)} aria-label="Delete template">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if creating}
    <div class="create-form card" style="margin-top:20px">
      <p class="sheet-title">New Template</p>
      <div class="field">
        <label class="field-label">Template name</label>
        <input class="field-input" bind:value={newName} placeholder="e.g. International Bac" />
      </div>
      <div class="field">
        <label class="field-label">Subjects</label>
        <div class="preset-list">
          {#each newPresets as preset, i}
            <div class="preset-row">
              <span class="preset-dot" style="background:{preset.color}"></span>
              <span class="preset-name">{preset.name}</span>
              <button class="remove-preset" on:click={() => removePreset(i)} aria-label="Remove">×</button>
            </div>
          {/each}
        </div>
        <div class="add-preset-row">
          <input
            class="field-input preset-input"
            bind:value={newSubjectName}
            placeholder="Subject name…"
            on:keydown={handlePresetKeydown}
          />
          <button class="add-preset-btn" on:click={addPresetRow} disabled={!newSubjectName.trim()}>Add</button>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn-cancel" on:click={() => { creating = false; newName = ''; newPresets = []; }}>Cancel</button>
        <button class="btn-save" on:click={saveTemplate} disabled={!newName.trim() || newPresets.length === 0}>Save</button>
      </div>
    </div>
  {:else}
    <button class="new-tpl-btn" on:click={() => creating = true} style="margin-top:20px">
      + New template
    </button>
  {/if}
</div>

<style>
  .page { padding: 20px 16px 80px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .back-btn { background: none; border: none; cursor: pointer; color: var(--text); padding: 0; line-height: 0; }
  .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 8px; }
  .template-list { display: flex; flex-direction: column; gap: 8px; }
  .template-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    text-decoration: none; color: var(--text);
  }
  .template-info { flex: 1; }
  .template-name { font-size: 15px; font-weight: 600; display: block; }
  .template-count { font-size: 12px; color: var(--muted); }
  .preview-dots { display: flex; align-items: center; gap: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot-more { font-size: 11px; color: var(--muted); }
  .chevron { color: var(--muted); flex-shrink: 0; }
  .custom-row { padding: 0; }
  .template-link { flex: 1; display: flex; align-items: center; gap: 12px; padding: 14px 0 14px 16px; text-decoration: none; color: var(--text); }
  .delete-tpl-btn { background: none; border: none; cursor: pointer; color: var(--muted); padding: 14px 16px; }

  .create-form { padding: 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
  .field { margin-bottom: 14px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-input {
    width: 100%; padding: 10px 12px; border: 1.5px solid var(--border);
    border-radius: var(--radius-md); background: var(--bg); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--primary); }
  .preset-list { margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; }
  .preset-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--bg3); border-radius: 8px; }
  .preset-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .preset-name { flex: 1; font-size: 14px; }
  .remove-preset { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 18px; line-height: 1; padding: 0 4px; }
  .add-preset-row { display: flex; gap: 8px; }
  .preset-input { flex: 1; }
  .add-preset-btn {
    padding: 10px 16px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
  }
  .add-preset-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .form-actions { display: flex; gap: 8px; margin-top: 16px; }
  .btn-cancel {
    flex: 1; padding: 10px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .btn-save {
    flex: 2; padding: 10px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
  .new-tpl-btn {
    display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 16px;
    border: 1.5px dashed var(--border); border-radius: var(--radius-md);
    background: none; color: var(--muted); font-size: 14px; font-weight: 500;
    cursor: pointer; transition: border-color 120ms ease, color 120ms ease;
  }
  .new-tpl-btn:hover { border-color: var(--primary); color: var(--text); }
</style>
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```powershell
git add 'src/routes/(app)/subjects/templates/+page.svelte'
git commit -m "feat: add Templates list page with create/delete custom templates"
```

---

### Task 6: Template detail page — checklist + "Add selected"

**Files:**
- Create: `src/routes/(app)/subjects/templates/[id]/+page.svelte`

- [ ] **Step 1: Create the file**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { subjects, templates, loadData, getAuthContext } from '$lib/stores/data';
  import { BUILTIN_TEMPLATES } from '$lib/constants';
  import { db } from '$lib/db';
  import type { Subject } from '$lib/types';

  onMount(() => loadData($auth));

  $: templateId = $page.params.id;
  $: allTemplates = [...BUILTIN_TEMPLATES, ...$templates];
  $: template = allTemplates.find(t => t.id === templateId);
  $: existingNames = new Set($subjects.map(s => s.name.toLowerCase()));

  let checked: Set<string> = new Set();

  $: if (template) {
    checked = new Set(
      template.presets
        .filter(p => !existingNames.has(p.name.toLowerCase()))
        .map(p => p.name)
    );
  }

  $: selectedCount = [...checked].filter(name => !existingNames.has(name.toLowerCase())).length;

  function toggle(name: string) {
    if (existingNames.has(name.toLowerCase())) return;
    const next = new Set(checked);
    if (next.has(name)) next.delete(name); else next.add(name);
    checked = next;
  }

  async function addSelected() {
    if (!template || selectedCount === 0) return;
    const { userId, mode } = getAuthContext();
    const maxOrder = $subjects.reduce((m, s) => Math.max(m, s.orderIndex), -1);
    const toAdd = template.presets.filter(p => checked.has(p.name) && !existingNames.has(p.name.toLowerCase()));
    const newSubjects: Subject[] = toAdd.map((p, i) => ({
      id: db.newId(),
      userId,
      name: p.name,
      symbol: p.symbol,
      color: p.color,
      colorRgb: p.colorRgb,
      orderIndex: maxOrder + 1 + i,
    }));
    subjects.update(all => [...all, ...newSubjects]);
    await Promise.all(newSubjects.map(s => db.saveSubject(s, mode)));
    goto('/subjects');
  }
</script>

<div class="page-enter page">
  <div class="header-row">
    <button class="back-btn" on:click={() => goto('/subjects/templates')} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <h1 class="text-large-title">{template?.name ?? '…'}</h1>
  </div>

  {#if !template}
    <p class="text-body text-muted">Template not found.</p>
  {:else}
    <p class="hint">Select subjects to add to your list. Already-added subjects are greyed out.</p>

    <ul class="preset-list">
      {#each template.presets as preset}
        {@const alreadyAdded = existingNames.has(preset.name.toLowerCase())}
        <li>
          <button
            class="preset-row card"
            class:already={alreadyAdded}
            on:click={() => toggle(preset.name)}
            disabled={alreadyAdded}
          >
            <span class="preset-symbol" style="color:{preset.color}">{preset.symbol}</span>
            <span class="preset-name">{preset.name}</span>
            {#if alreadyAdded}
              <span class="already-label">Added</span>
            {:else}
              <span class="check-circle" class:checked={checked.has(preset.name)}>
                {#if checked.has(preset.name)}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" fill="var(--primary)" stroke="var(--primary)" stroke-width="1.5"/>
                    <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="var(--border)" stroke-width="1.5"/>
                  </svg>
                {/if}
              </span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    <div class="sticky-footer">
      <button class="btn-add" on:click={addSelected} disabled={selectedCount === 0}>
        Add {selectedCount > 0 ? selectedCount : ''} subject{selectedCount !== 1 ? 's' : ''}
      </button>
    </div>
  {/if}
</div>

<style>
  .page { padding: 20px 16px 120px; max-width: 600px; margin: 0 auto; }
  .header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .back-btn { background: none; border: none; cursor: pointer; color: var(--text); padding: 0; line-height: 0; }
  .hint { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
  .preset-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .preset-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    width: 100%; text-align: left; cursor: pointer;
    transition: background 120ms ease;
  }
  .preset-row:hover:not(:disabled) { background: var(--bg3); }
  .preset-row.already { opacity: 0.5; cursor: default; }
  .preset-symbol { font-size: 15px; font-weight: 700; width: 28px; flex-shrink: 0; }
  .preset-name { flex: 1; font-size: 15px; font-weight: 500; color: var(--text); }
  .already-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .check-circle { flex-shrink: 0; line-height: 0; }

  .sticky-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 12px 16px 32px; background: var(--bg2);
    border-top: 1px solid var(--border); z-index: 100;
  }
  .btn-add {
    display: block; width: 100%; max-width: 600px; margin: 0 auto;
    padding: 14px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit;
    font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Run type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```powershell
git add 'src/routes/(app)/subjects/templates/[id]/+page.svelte'
git commit -m "feat: add template detail page with checklist and add-selected flow"
```

---

### Task 7: i18n keys + final type check + push

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/th.ts`

- [ ] **Step 1: Add template keys to `src/lib/i18n/en.ts`**

Find the `subjects: { ... }` block and add these keys inside it (after `noSubjects`):

```ts
    templates: 'Templates',
    newTemplate: 'New template',
    builtIn: 'BUILT-IN',
    custom: 'CUSTOM',
    subjectsCount: (n: number) => `${n} subjects`,
    addSelected: (n: number) => `Add ${n} subject${n !== 1 ? 's' : ''}`,
    alreadyAdded: 'Added',
    selectHint: 'Select subjects to add to your list. Already-added subjects are greyed out.',
    templateNotFound: 'Template not found.',
```

- [ ] **Step 2: Add template keys to `src/lib/i18n/th.ts`**

Add the same keys inside the `subjects: { ... }` block (after `noSubjects`):

```ts
    templates: 'เทมเพลต',
    newTemplate: 'เทมเพลตใหม่',
    builtIn: 'มาตรฐาน',
    custom: 'กำหนดเอง',
    subjectsCount: (n: number) => `${n} วิชา`,
    addSelected: (n: number) => `เพิ่ม ${n} วิชา`,
    alreadyAdded: 'เพิ่มแล้ว',
    selectHint: 'เลือกวิชาที่ต้องการเพิ่ม วิชาที่มีอยู่แล้วจะเป็นสีเทา',
    templateNotFound: 'ไม่พบเทมเพลต',
```

- [ ] **Step 3: Final type check**

```powershell
npx tsc --noEmit
```

Expected: 0 new errors (only pre-existing a11y warnings).

- [ ] **Step 4: Commit and push**

```powershell
git add src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat: add subject template i18n keys"
git push origin master
```

---

## Self-Review

**Spec coverage:**
- ✅ `/subjects` — "+" button, edit icons on tiles, "Templates" link → Task 4
- ✅ `/subjects/templates` — built-ins + custom list, "New template" form → Task 5
- ✅ `/subjects/templates/[id]` — checklist, already-added greyed, "Add selected" → Task 6
- ✅ 3 built-in templates (TCAS 14 subjects, Medicine 10, Engineering 5) → Task 1
- ✅ Custom template CRUD (create with name + subjects, delete) → Tasks 2, 3, 5
- ✅ Add custom subject (name, symbol, 8-color swatches) → Task 4
- ✅ Edit subject (pre-filled sheet, save or delete) → Task 4
- ✅ Delete subject cascades topics + srs_cards in guest mode → Task 2
- ✅ i18n keys for both locales → Task 7

**Placeholder scan:** None found. All steps have complete code.

**Type consistency:**
- `SubjectPreset` fields (`name`, `symbol`, `color`, `colorRgb`) — consistent across types.ts, constants.ts, db.ts, all page files
- `Template` fields (`id`, `userId`, `name`, `presets`, `createdAt`) — consistent throughout
- `db.saveTemplate` / `db.deleteTemplate` / `db.getTemplates` — named consistently
- `templates` writable — imported correctly in all pages that use it
