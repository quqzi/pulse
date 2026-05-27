# Templates with Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow templates to include topics per subject — users can save their current subjects+topics as a template, and can add topics when creating a new template manually.

**Architecture:** Extend `SubjectPreset` in types to include an optional `topics` string array. No DB schema change needed — topics are stored as JSON inside the preset object. Update the template creator UI to add/remove topics per subject row. Add a "Save as template" button to the subjects page that reads live subjects+topics from the store.

**Tech Stack:** SvelteKit 2, TypeScript, Supabase (templates table already exists)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/lib/types.ts` | Modify | Add `topics?: string[]` to `SubjectPreset` |
| `src/routes/(app)/subjects/templates/+page.svelte` | Modify | Topic input per preset row in creator |
| `src/routes/(app)/subjects/+page.svelte` | Modify | "Save as template" button |
| `src/routes/(app)/subjects/templates/[id]/+page.svelte` | Modify | Extend addSelected() to create topics + SRS cards |

---

### Task 1: Extend SubjectPreset type

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Find SubjectPreset in types.ts**

Open `src/lib/types.ts`. Find `SubjectPreset` — it currently looks like:
```ts
export interface SubjectPreset {
  name: string;
  symbol: string;
  color: string;
  colorRgb: string;
}
```

- [ ] **Step 2: Add topics field**

```ts
export interface SubjectPreset {
  name: string;
  symbol: string;
  color: string;
  colorRgb: string;
  topics?: string[]; // topic names to create when applying this preset
}
```

- [ ] **Step 3: Run type check**

```powershell
npm run check
```

Expected: 0 errors. The field is optional so no existing code breaks.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/types.ts
git commit -m "feat: add optional topics field to SubjectPreset type"
```

---

### Task 2: Add topic input to template creator UI

**Files:**
- Modify: `src/routes/(app)/subjects/templates/+page.svelte`

The template creator currently shows a list of subject preset rows (name + color dot). Each row needs an expandable topic section where the user can add topic names.

- [ ] **Step 1: Read the current creator markup**

Open `src/routes/(app)/subjects/templates/+page.svelte`. Find the section that renders `newPresets` rows and the `addPresetRow` / `removePreset` functions.

- [ ] **Step 2: Add topic state and helpers**

In the `<script>` block, add helpers for managing topics per preset:

```ts
function addTopic(presetIdx: number, name: string) {
  if (!name.trim()) return;
  newPresets = newPresets.map((p, i) => {
    if (i !== presetIdx) return p;
    return { ...p, topics: [...(p.topics ?? []), name.trim()] };
  });
}

function removeTopic(presetIdx: number, topicIdx: number) {
  newPresets = newPresets.map((p, i) => {
    if (i !== presetIdx) return p;
    return { ...p, topics: (p.topics ?? []).filter((_, ti) => ti !== topicIdx) };
  });
}
```

Also add a per-preset topic input state (use an array indexed by preset):
```ts
let topicInputs: string[] = [];

// Keep topicInputs in sync with newPresets length
$: if (topicInputs.length !== newPresets.length) {
  topicInputs = newPresets.map((_, i) => topicInputs[i] ?? '');
}
```

- [ ] **Step 3: Update the preset row markup**

For each preset row in the template, add a collapsible topic section below the subject name/color inputs:

```svelte
{#each newPresets as preset, i}
  <div class="preset-row">
    <!-- existing subject name + remove button -->
    <div class="preset-header">
      <span class="preset-dot" style="background:{preset.color}"></span>
      <span class="preset-name">{preset.name}</span>
      <button class="remove-btn" on:click={() => removePreset(i)}>×</button>
    </div>
    <!-- topic list -->
    {#if preset.topics && preset.topics.length > 0}
      <div class="topic-chips">
        {#each preset.topics as topic, ti}
          <span class="topic-chip">
            {topic}
            <button class="chip-remove" on:click={() => removeTopic(i, ti)}>×</button>
          </span>
        {/each}
      </div>
    {/if}
    <!-- topic input -->
    <div class="topic-input-row">
      <input
        class="topic-input"
        placeholder="Add topic…"
        bind:value={topicInputs[i]}
        on:keydown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addTopic(i, topicInputs[i]); topicInputs[i] = ''; }
        }}
      />
      <button class="add-topic-btn" on:click={() => { addTopic(i, topicInputs[i]); topicInputs[i] = ''; }}>+</button>
    </div>
  </div>
{/each}
```

- [ ] **Step 4: Add CSS for topic chips and input**

Add to the `<style>` block:
```css
.topic-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 4px; padding: 0 12px; }
.topic-chip { display: flex; align-items: center; gap: 4px; font-size: 11px; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; color: var(--text); }
.chip-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
.chip-remove:hover { color: var(--text); }
.topic-input-row { display: flex; align-items: center; gap: 6px; padding: 4px 12px 8px; }
.topic-input { flex: 1; font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; color: var(--text); }
.add-topic-btn { font-size: 16px; background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); cursor: pointer; padding: 2px 8px; }
.add-topic-btn:hover { color: var(--text); background: var(--bg3); }
```

- [ ] **Step 5: Verify template saves topics**

The `saveTemplate` function already calls `db.saveTemplate(template, mode)` with `presets: newPresets`. Since `newPresets` now includes `topics`, no change needed to `saveTemplate` — topics are stored as part of the JSON preset.

- [ ] **Step 6: Run type check**

```powershell
npm run check
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```powershell
git add "src/routes/(app)/subjects/templates/+page.svelte"
git commit -m "feat: add topic input per subject in template creator"
```

---

### Task 3: "Save as template" button on subjects page

**Files:**
- Modify: `src/routes/(app)/subjects/+page.svelte`

Users should be able to save their current subjects (with their topics) as a new template in one click.

- [ ] **Step 1: Read the subjects page**

Open `src/routes/(app)/subjects/+page.svelte`. Note how subjects and topics are accessed from stores (`$subjects`, `$topics`). Find the page header area where a button can be added.

- [ ] **Step 2: Add imports and the save function**

Ensure `templates`, `getAuthContext`, and `db` are imported. Add:

```ts
import { subjects, topics, templates, loadData, getAuthContext } from '$lib/stores/data';
import type { Template, SubjectPreset } from '$lib/types';

async function saveCurrentAsTemplate() {
  const name = prompt('Template name:');
  if (!name?.trim()) return;
  const { userId, mode } = getAuthContext();
  const presets: SubjectPreset[] = $subjects.map(sub => ({
    name: sub.name,
    symbol: sub.symbol,
    color: sub.color,
    colorRgb: sub.colorRgb,
    topics: $topics.filter(t => t.subjectId === sub.id).map(t => t.name),
  }));
  const template: Template = {
    id: db.newId(),
    userId,
    name: name.trim(),
    presets,
    createdAt: new Date().toISOString(),
  };
  templates.update(all => [...all, template]);
  await db.saveTemplate(template, mode);
}
```

- [ ] **Step 3: Add the button to the page header**

In the page markup, find the header row (usually has a title and possibly an "Add subject" button). Add alongside it:

```svelte
<button class="save-template-btn" on:click={saveCurrentAsTemplate}>Save as template</button>
```

- [ ] **Step 4: Add CSS**

```css
.save-template-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg2);
  color: var(--muted);
  cursor: pointer;
}
.save-template-btn:hover { background: var(--bg3); color: var(--text); }
```

- [ ] **Step 5: Run type check**

```powershell
npm run check
```

Expected: 0 errors.

- [ ] **Step 6: Verify**

Run `npm run dev`. Go to `/subjects`. Click "Save as template", enter a name. Navigate to `/subjects/templates` — the new template should appear with all subjects and their topics listed.

- [ ] **Step 7: Commit**

```powershell
git add "src/routes/(app)/subjects/+page.svelte"
git commit -m "feat: add save-as-template button to subjects page"
```

---

### Task 4: Apply topics when a template is applied

**Files:**
- Modify: `src/routes/(app)/subjects/templates/[id]/+page.svelte`

The `addSelected()` function in this file creates subjects from the selected presets. It needs to also create topics for each subject.

Also need to import `topics` and `srsCards` stores since `db.saveTopic` returns an `SrsCard` that must be added to the `srsCards` store.

- [ ] **Step 1: Read the file**

Open `src/routes/(app)/subjects/templates/[id]/+page.svelte`. Find `addSelected()` — it currently iterates `toAdd` presets, creates `Subject` objects with `orderIndex`, saves them, then calls `goto('/subjects')`.

Note the existing imports: `subjects`, `templates`, `loadData`, `getAuthContext` from data store, and `db` from `$lib/db`.

- [ ] **Step 2: Add missing imports**

Add `topics` and `srsCards` to the data store import line:
```ts
import { subjects, topics, srsCards, templates, loadData, getAuthContext } from '$lib/stores/data';
```

- [ ] **Step 3: Extend addSelected to create topics**

The `db.saveTopic(topic, userId, mode)` signature takes three arguments and returns `Promise<SrsCard>` (it also creates the SRS card). Replace the existing `addSelected` with:

```ts
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

  for (let i = 0; i < toAdd.length; i++) {
    const preset = toAdd[i];
    const subject = newSubjects[i];
    for (const topicName of preset.topics ?? []) {
      const topic: Topic = {
        id: db.newId(),
        userId,
        subjectId: subject.id,
        name: topicName,
        orderIndex: 0,
      };
      topics.update(all => [...all, topic]);
      const card = await db.saveTopic(topic, userId, mode);
      srsCards.update(all => [...all, card]);
    }
  }

  goto('/subjects');
}
```

Also add `Topic` to the type imports at the top of the file:
```ts
import type { Subject, Topic } from '$lib/types';
```

- [ ] **Step 4: Run type check**

```powershell
npm run check
```

Expected: 0 errors.

- [ ] **Step 5: Verify**

Create a template with subjects and topics. Apply it. Go to `/subjects` — all subjects should appear. Click a subject — its topics should be listed.

- [ ] **Step 6: Commit**

```powershell
git add "src/routes/(app)/subjects/templates/[id]/+page.svelte"
git commit -m "feat: create topics and SRS cards when applying a template"
```

---

### Task 5: Push

```powershell
git push origin master
```
