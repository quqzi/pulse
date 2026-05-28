# Exam Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Exam Simulation feature to Pulse — a readiness score card on the dashboard, a question bank page, and a configurable mock exam with overall/per-question timer modes.

**Architecture:** Three connected pieces: (1) `ExamQuestion` + `ExamSession` types/DB/stores following existing patterns in `types.ts`, `db.ts`, `data.ts`; (2) two new pages at `/exam` (setup→running→results) and `/exam/questions` (question bank); (3) a readiness score derived store shown as a card on `/dashboard`.

**Tech Stack:** SvelteKit 2, TypeScript, Supabase JS v2, plain CSS with `var(--*)` tokens. No new libraries.

**Spec:** `docs/superpowers/specs/2026-05-28-exam-simulation-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/types.ts` | Add `ExamQuestion`, `ExamSession` interfaces |
| Modify | `src/lib/db.ts` | Add exam DB methods (get/save/delete) |
| Modify | `src/lib/stores/data.ts` | Add `examQuestions`, `examSessions` writables, `readinessScore` derived, populate in `loadData()` |
| Modify | `src/lib/components/Sidebar.svelte` | Add Exam nav item to Track group |
| Create | `src/routes/(app)/exam/+page.svelte` | Setup / running / results phases |
| Create | `src/routes/(app)/exam/questions/+page.svelte` | Question bank list + add/edit form |
| Modify | `src/routes/(app)/dashboard/+page.svelte` | Import and render readiness score card |
| Create | `src/lib/components/ReadinessCard.svelte` | Readiness score card component |

---

## Task 1: Add types to `types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `ExamQuestion` and `ExamSession` interfaces at the end of `src/lib/types.ts`**

```ts
export interface ExamQuestion {
  id: string;
  userId: string;
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  year?: number;
  createdAt: string;
}

export interface ExamSession {
  id: string;
  userId: string;
  subjectScores: Record<string, { correct: number; total: number }>;
  totalCorrect: number;
  totalQuestions: number;
  durationSeconds: number;
  timerMode: 'overall' | 'per-question';
  createdAt: string;
}
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(exam): add ExamQuestion and ExamSession types"
```

---

## Task 2: Add DB methods to `db.ts`

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add import for new types at the top of `db.ts`**

Change the existing import line from:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template, SubjectPreset, ScheduleSlot, IdealWeekSlot, MockScore } from '$lib/types';
```
To:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template, SubjectPreset, ScheduleSlot, IdealWeekSlot, MockScore, ExamQuestion, ExamSession } from '$lib/types';
```

- [ ] **Step 2: Add mapper functions after `mapScoreFromDb` (around line 161)**

```ts
function mapExamQuestionFromDb(row: Record<string, unknown>): ExamQuestion {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    text: row.text as string,
    choices: row.choices as [string, string, string, string],
    correctIndex: row.correct_index as 0 | 1 | 2 | 3,
    subject: row.subject as string,
    difficulty: row.difficulty as ExamQuestion['difficulty'],
    year: (row.year as number | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function mapExamSessionFromDb(row: Record<string, unknown>): ExamSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subjectScores: row.subject_scores as Record<string, { correct: number; total: number }>,
    totalCorrect: row.total_correct as number,
    totalQuestions: row.total_questions as number,
    durationSeconds: row.duration_seconds as number,
    timerMode: row.timer_mode as ExamSession['timerMode'],
    createdAt: row.created_at as string,
  };
}
```

- [ ] **Step 3: Add DB methods inside the `db` object, after the `deleteScore` method and before `newId`**

```ts
  // ── EXAM QUESTIONS ────────────────────────────────────────
  async getExamQuestions(userId: string, mode: Mode): Promise<ExamQuestion[]> {
    if (mode === 'guest') return lsGet<ExamQuestion>('pulse_exam_questions');
    const { data } = await supabase.from('exam_questions').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(mapExamQuestionFromDb);
  },

  async saveExamQuestion(q: ExamQuestion, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<ExamQuestion>('pulse_exam_questions');
      const idx = all.findIndex(x => x.id === q.id);
      if (idx >= 0) all[idx] = q; else all.unshift(q);
      lsSet('pulse_exam_questions', all);
      return;
    }
    await supabase.from('exam_questions').upsert({
      id: q.id,
      user_id: q.userId,
      text: q.text,
      choices: q.choices,
      correct_index: q.correctIndex,
      subject: q.subject,
      difficulty: q.difficulty,
      year: q.year ?? null,
      created_at: q.createdAt,
    });
  },

  async deleteExamQuestion(questionId: string, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      lsSet('pulse_exam_questions', lsGet<ExamQuestion>('pulse_exam_questions').filter(q => q.id !== questionId));
      return;
    }
    await supabase.from('exam_questions').delete().eq('id', questionId);
  },

  // ── EXAM SESSIONS ─────────────────────────────────────────
  async getExamSessions(userId: string, mode: Mode): Promise<ExamSession[]> {
    if (mode === 'guest') return lsGet<ExamSession>('pulse_exam_sessions');
    const { data } = await supabase.from('exam_sessions').select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []).map(mapExamSessionFromDb);
  },

  async saveExamSession(s: ExamSession, mode: Mode): Promise<void> {
    if (mode === 'guest') {
      const all = lsGet<ExamSession>('pulse_exam_sessions');
      all.unshift(s);
      lsSet('pulse_exam_sessions', all);
      return;
    }
    await supabase.from('exam_sessions').insert({
      id: s.id,
      user_id: s.userId,
      subject_scores: s.subjectScores,
      total_correct: s.totalCorrect,
      total_questions: s.totalQuestions,
      duration_seconds: s.durationSeconds,
      timer_mode: s.timerMode,
      created_at: s.createdAt,
    });
  },
```

- [ ] **Step 4: Type-check**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(exam): add exam question and session DB methods"
```

---

## Task 3: Supabase migration

**Files:**
- Supabase tables: `exam_questions`, `exam_sessions`

- [ ] **Step 1: Apply migration using Supabase MCP tool**

Run this SQL via `mcp__plugin_supabase_supabase__apply_migration`:

```sql
-- exam_questions
create table if not exists exam_questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  choices      text[] not null,
  correct_index smallint not null check (correct_index between 0 and 3),
  subject      text not null,
  difficulty   text not null check (difficulty in ('easy','medium','hard')),
  year         smallint,
  created_at   timestamptz not null default now()
);

alter table exam_questions enable row level security;

create policy "users manage own exam questions"
  on exam_questions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- exam_sessions
create table if not exists exam_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  subject_scores   jsonb not null default '{}',
  total_correct    smallint not null,
  total_questions  smallint not null,
  duration_seconds int not null,
  timer_mode       text not null check (timer_mode in ('overall','per-question')),
  created_at       timestamptz not null default now()
);

alter table exam_sessions enable row level security;

create policy "users manage own exam sessions"
  on exam_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Verify tables exist**

Run via `mcp__plugin_supabase_supabase__execute_sql`:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('exam_questions','exam_sessions');
```

Expected: 2 rows returned.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat(exam): create exam_questions and exam_sessions tables in Supabase"
```

---

## Task 4: Update stores in `data.ts`

**Files:**
- Modify: `src/lib/stores/data.ts`

- [ ] **Step 1: Add import for new types**

Change the existing import line:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template, ScheduleSlot, MockScore } from '$lib/types';
```
To:
```ts
import type { Subject, Topic, SrsCard, StudySession, Task, Template, ScheduleSlot, MockScore, ExamQuestion, ExamSession } from '$lib/types';
```

- [ ] **Step 2: Add two new writables after the `scores` writable**

```ts
export const examQuestions = writable<ExamQuestion[]>([]);
export const examSessions  = writable<ExamSession[]>([]);
```

- [ ] **Step 3: Add `readinessScore` derived store after the `tasksDueToday` derived**

```ts
export const readinessScore = derived(
  [subjects, srsCards, sessions, examSessions],
  ([$subjects, $srsCards, $sessions, $examSessions]) => {
    if ($subjects.length === 0) return { overall: 0, bySubject: {} as Record<string, number> };

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bySubject: Record<string, number> = {};

    for (const subj of $subjects) {
      const cards = $srsCards.filter(c => c.subjectId === subj.id);
      const srsScore = cards.length === 0 ? 0 :
        cards.filter(c => c.ease >= 2.5).length / cards.length;

      const recentSecs = $sessions
        .filter(s => s.subjectId === subj.id && new Date(s.startedAt) >= cutoff)
        .reduce((sum, s) => sum + s.durationSec, 0);
      const hoursScore = Math.min(recentSecs / 3600 / 20, 1);

      const examScores = $examSessions
        .map(es => {
          const sub = es.subjectScores[subj.id];
          return sub && sub.total > 0 ? sub.correct / sub.total : null;
        })
        .filter((s): s is number => s !== null);
      const examScore = examScores.length === 0 ? 0 :
        examScores.reduce((a, b) => a + b, 0) / examScores.length;

      bySubject[subj.id] = Math.round((srsScore * 0.4 + hoursScore * 0.3 + examScore * 0.3) * 100);
    }

    const overall = Math.round(
      Object.values(bySubject).reduce((a, b) => a + b, 0) / $subjects.length
    );
    return { overall, bySubject };
  }
);
```

- [ ] **Step 4: Update `loadData()` to fetch exam data**

In the `Promise.all` call inside `loadData()`, add `db.getExamQuestions` and `db.getExamSessions`:

```ts
  const [s, t, c, sess, tsk, tmpl, sc, eq, es] = await Promise.all([
    db.getSubjects(userId, mode),
    db.getTopics(userId, mode),
    db.getSrsCards(userId, mode),
    db.getSessions(userId, mode),
    db.getTasks(userId, mode),
    db.getTemplates(userId, mode),
    db.getScores(userId, mode),
    db.getExamQuestions(userId, mode),
    db.getExamSessions(userId, mode),
  ]);
  subjects.set(s);
  topics.set(t);
  srsCards.set(c);
  sessions.set(sess);
  tasks.set(tsk);
  templates.set(tmpl);
  scores.set(sc);
  examQuestions.set(eq);
  examSessions.set(es);
```

- [ ] **Step 5: Type-check**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/data.ts
git commit -m "feat(exam): add examQuestions, examSessions stores and readinessScore derived"
```

---

## Task 5: Add Exam to sidebar

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`

- [ ] **Step 1: Add Exam nav item to the Track group in `Sidebar.svelte`**

In the `Track` group items array, add after the `Scores` entry:

```ts
{ label: 'Exam', href: '/exam', d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0-1 2h4a2 2 0 0 0-1-2M9 12l2 2 4-4' },
```

The full Track group should now read:
```ts
{ label: 'Track', colorVar: 'var(--nav-track)', items: [
  { label: 'Analytics', href: '/analytics', d: 'M18 20V10M12 20V4M6 20v-6' },
  { label: 'Insights',  href: '/insights',  d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 8v4M12 16h.01' },
  { label: 'Journey',   href: '/journey',   d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { label: 'Tasks',     href: '/tasks',     d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { label: 'Schedule',  href: '/schedule',  d: 'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M2 10h20' },
  { label: 'Scores',    href: '/scores',    d: 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6' },
  { label: 'Exam',      href: '/exam',      d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0-1 2h4a2 2 0 0 0-1-2M9 12l2 2 4-4' },
]},
```

- [ ] **Step 2: Check nav highlights correctly — `/exam` and `/exam/questions` should both highlight the Exam item**

The existing `class:active={path.startsWith(item.href)}` already handles this since `/exam/questions` starts with `/exam`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/Sidebar.svelte
git commit -m "feat(exam): add Exam nav item to sidebar"
```

---

## Task 6: Question Bank page

**Files:**
- Create: `src/routes/(app)/exam/questions/+page.svelte`

- [ ] **Step 1: Create the file**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { examQuestions, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { db } from '$lib/db';
  import type { ExamQuestion } from '$lib/types';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  let search = '';
  let filterSubject = 'all';
  let showForm = false;
  let editingQuestion: ExamQuestion | null = null;

  // Form state
  let formText = '';
  let formChoices: [string, string, string, string] = ['', '', '', ''];
  let formCorrectIndex: 0 | 1 | 2 | 3 = 0;
  let formSubject = '';
  let formDifficulty: ExamQuestion['difficulty'] = 'medium';
  let formYear = '';

  $: filteredQuestions = $examQuestions.filter(q => {
    const matchesSearch = search === '' || q.text.toLowerCase().includes(search.toLowerCase());
    const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
    return matchesSearch && matchesSubject;
  });

  $: subjectOptions = [...new Set($examQuestions.map(q => q.subject))].sort();

  function openAdd() {
    editingQuestion = null;
    formText = '';
    formChoices = ['', '', '', ''];
    formCorrectIndex = 0;
    formSubject = $subjects[0]?.name ?? '';
    formDifficulty = 'medium';
    formYear = '';
    showForm = true;
  }

  function openEdit(q: ExamQuestion) {
    editingQuestion = q;
    formText = q.text;
    formChoices = [...q.choices] as [string, string, string, string];
    formCorrectIndex = q.correctIndex;
    formSubject = q.subject;
    formDifficulty = q.difficulty;
    formYear = q.year ? String(q.year) : '';
    showForm = true;
  }

  function cancelForm() {
    showForm = false;
    editingQuestion = null;
  }

  async function saveQuestion() {
    if (!formText.trim() || formChoices.some(c => !c.trim())) return;
    const { userId, mode } = getAuthContext();
    const q: ExamQuestion = {
      id: editingQuestion?.id ?? db.newId(),
      userId,
      text: formText.trim(),
      choices: formChoices.map(c => c.trim()) as [string, string, string, string],
      correctIndex: formCorrectIndex,
      subject: formSubject,
      difficulty: formDifficulty,
      year: formYear ? parseInt(formYear, 10) : undefined,
      createdAt: editingQuestion?.createdAt ?? new Date().toISOString(),
    };
    await db.saveExamQuestion(q, mode);
    examQuestions.update(all => {
      const idx = all.findIndex(x => x.id === q.id);
      if (idx >= 0) { const next = [...all]; next[idx] = q; return next; }
      return [q, ...all];
    });
    cancelForm();
  }

  async function deleteQuestion(q: ExamQuestion) {
    if (!confirm(`Delete this question?`)) return;
    const { mode } = getAuthContext();
    await db.deleteExamQuestion(q.id, mode);
    examQuestions.update(all => all.filter(x => x.id !== q.id));
  }

  function difficultyLabel(d: ExamQuestion['difficulty']): string {
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Question Bank</h1>
      <p class="page-sub">{$examQuestions.length} questions</p>
    </div>
    <div class="header-actions">
      <a href="/exam" class="btn-secondary">← Mock Exam</a>
      <button class="btn-primary" on:click={openAdd}>+ Add Question</button>
    </div>
  </div>

  <div class="toolbar">
    <input class="search" type="text" placeholder="Search questions…" bind:value={search} />
    <select bind:value={filterSubject}>
      <option value="all">All subjects</option>
      {#each subjectOptions as s}
        <option value={s}>{s}</option>
      {/each}
    </select>
  </div>

  {#if showForm}
    <div class="form-card">
      <h3 class="form-title">{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>

      <label class="field-label">Question</label>
      <textarea class="field-input" bind:value={formText} rows={3} placeholder="Enter question text…"></textarea>

      <label class="field-label">Choices — click circle to mark correct</label>
      {#each formChoices as choice, i}
        <div class="choice-row">
          <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
          <input class="field-input choice-input" bind:value={formChoices[i]} placeholder="Choice {String.fromCharCode(65 + i)}" />
          <button
            class="correct-btn"
            class:selected={formCorrectIndex === i}
            on:click={() => formCorrectIndex = i as 0 | 1 | 2 | 3}
            title="Mark as correct"
          ></button>
        </div>
      {/each}

      <div class="form-row">
        <div class="form-col">
          <label class="field-label">Subject</label>
          <select class="field-input" bind:value={formSubject}>
            {#each $subjects as s}
              <option value={s.name}>{s.name}</option>
            {/each}
          </select>
        </div>
        <div class="form-col">
          <label class="field-label">Difficulty</label>
          <select class="field-input" bind:value={formDifficulty}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div class="form-col">
          <label class="field-label">Year (optional)</label>
          <input class="field-input" bind:value={formYear} placeholder="e.g. 2024" maxlength={4} />
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" on:click={cancelForm}>Cancel</button>
        <button class="btn-primary" on:click={saveQuestion}
          disabled={!formText.trim() || formChoices.some(c => !c.trim())}>
          Save Question
        </button>
      </div>
    </div>
  {/if}

  {#if filteredQuestions.length === 0}
    <div class="empty-state">
      <p class="empty-title">{$examQuestions.length === 0 ? 'No questions yet.' : 'No questions match.'}</p>
      <p class="empty-sub">{$examQuestions.length === 0 ? 'Add your first question to get started.' : 'Try a different search or filter.'}</p>
    </div>
  {:else}
    <div class="question-list">
      {#each filteredQuestions as q (q.id)}
        <div class="question-row">
          <div class="q-content">
            <p class="q-text">{q.text}</p>
            <div class="q-tags">
              <span class="tag tag-subject">{q.subject}</span>
              <span class="tag tag-diff">{difficultyLabel(q.difficulty)}</span>
              {#if q.year}<span class="tag tag-year">{q.year}</span>{/if}
            </div>
          </div>
          <div class="q-actions">
            <button class="action-btn" on:click={() => openEdit(q)}>Edit</button>
            <button class="action-btn action-delete" on:click={() => deleteQuestion(q)}>✕</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 780px; margin: 0 auto; padding: 32px 24px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 2px; }
  .page-sub { font-size: 13px; color: var(--muted); margin: 0; }
  .header-actions { display: flex; gap: 8px; }
  .btn-primary { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary { background: var(--bg2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 14px; font-size: 13px; cursor: pointer; text-decoration: none; }
  .toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
  .search { flex: 1; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; font-size: 13px; color: var(--text); }
  .toolbar select { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 12px; font-size: 13px; color: var(--text); }
  .form-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; }
  .form-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0 0 16px; }
  .field-label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin: 12px 0 4px; }
  .field-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 13px; color: var(--text); box-sizing: border-box; }
  .choice-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .choice-letter { width: 16px; font-size: 12px; font-weight: 600; color: var(--muted); flex-shrink: 0; }
  .choice-input { flex: 1; }
  .correct-btn { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border); background: transparent; cursor: pointer; flex-shrink: 0; transition: background 0.15s, border-color 0.15s; }
  .correct-btn.selected { background: var(--primary); border-color: var(--primary); }
  .form-row { display: flex; gap: 12px; }
  .form-col { flex: 1; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
  .question-list { display: flex; flex-direction: column; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
  .question-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; background: var(--bg2); }
  .q-content { flex: 1; min-width: 0; }
  .q-text { font-size: 13px; font-weight: 500; color: var(--text); margin: 0 0 6px; line-height: 1.4; }
  .q-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
  .tag-subject { background: var(--primary-l); color: var(--primary); }
  .tag-diff { background: var(--bg3); color: var(--muted); }
  .tag-year { background: var(--bg3); color: var(--muted); }
  .q-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .action-btn { background: none; border: none; font-size: 12px; color: var(--muted); cursor: pointer; padding: 2px 4px; }
  .action-btn:hover { color: var(--text); }
  .action-delete:hover { color: #ef4444; }
</style>
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Start dev server and verify page loads at http://localhost:5173/exam/questions**

```bash
npm run dev
```

Check: page renders, "No questions yet." empty state shows, "Add Question" button opens the form, form closes with Cancel.

- [ ] **Step 4: Commit**

```bash
git add src/routes/(app)/exam/questions/+page.svelte
git commit -m "feat(exam): add question bank page with add/edit/delete"
```

---

## Task 7: Exam page (setup → running → results)

**Files:**
- Create: `src/routes/(app)/exam/+page.svelte`

- [ ] **Step 1: Create the file**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { examQuestions, examSessions, subjects, loadData, getAuthContext } from '$lib/stores/data';
  import { db } from '$lib/db';
  import type { ExamQuestion, ExamSession } from '$lib/types';

  onMount(() => loadData($auth));
  $: if ($auth.mode !== 'loading') loadData($auth);

  // ── Phase ────────────────────────────────────────────────
  type Phase = 'setup' | 'running' | 'results';
  let phase: Phase = 'setup';

  // ── Setup config ─────────────────────────────────────────
  let selectedSubjects: string[] = [];
  let selectedDifficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
  let questionsPerSubject = 10;
  let useAllQuestions = false;
  let timerMode: 'overall' | 'per-question' = 'overall';
  let overallMinutes = 30;
  let noOverallLimit = false;
  let secondsPerQuestion = 60;

  $: availableSubjects = [...new Set($examQuestions.map(q => q.subject))].sort();

  $: filteredPool = $examQuestions.filter(q =>
    selectedSubjects.includes(q.subject) &&
    selectedDifficulties.includes(q.difficulty)
  );

  $: totalQuestions = useAllQuestions
    ? filteredPool.length
    : selectedSubjects.reduce((sum, s) => {
        const available = filteredPool.filter(q => q.subject === s).length;
        return sum + Math.min(questionsPerSubject, available);
      }, 0);

  $: canStart = selectedSubjects.length > 0 && selectedDifficulties.length > 0 && filteredPool.length > 0;

  $: summaryLine = canStart
    ? `${totalQuestions} question${totalQuestions !== 1 ? 's' : ''} · ${selectedSubjects.join(' + ')} · ${selectedDifficulties.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ')} · ${timerMode === 'overall' ? (noOverallLimit ? 'No time limit' : `${overallMinutes} min overall`) : `${secondsPerQuestion}s per question`}`
    : 'No questions match this selection — add questions first.';

  function toggleSubject(s: string) {
    selectedSubjects = selectedSubjects.includes(s)
      ? selectedSubjects.filter(x => x !== s)
      : [...selectedSubjects, s];
  }

  function toggleDifficulty(d: 'easy' | 'medium' | 'hard') {
    selectedDifficulties = selectedDifficulties.includes(d)
      ? selectedDifficulties.filter(x => x !== d)
      : [...selectedDifficulties, d];
  }

  // ── Running state ─────────────────────────────────────────
  let queue: ExamQuestion[] = [];
  let currentIndex = 0;
  let answers: (number | null)[] = [];
  let startedAt = 0;

  // Overall timer
  let overallSecondsLeft = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // Per-question timer
  let perQuestionSecondsLeft = 0;
  let perQuestionInterval: ReturnType<typeof setInterval> | null = null;

  $: current = queue[currentIndex] ?? null;
  $: progressPct = queue.length > 0 ? ((currentIndex) / queue.length) * 100 : 0;

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue(): ExamQuestion[] {
    const result: ExamQuestion[] = [];
    for (const subj of selectedSubjects) {
      const pool = shuffle(filteredPool.filter(q => q.subject === subj));
      const take = useAllQuestions ? pool.length : Math.min(questionsPerSubject, pool.length);
      result.push(...pool.slice(0, take));
    }
    return shuffle(result);
  }

  function startExam() {
    queue = buildQueue();
    answers = new Array(queue.length).fill(null);
    currentIndex = 0;
    startedAt = Date.now();
    phase = 'running';

    if (timerMode === 'overall' && !noOverallLimit) {
      overallSecondsLeft = overallMinutes * 60;
      timerInterval = setInterval(() => {
        overallSecondsLeft--;
        if (overallSecondsLeft <= 0) finishExam();
      }, 1000);
    }

    if (timerMode === 'per-question') {
      startPerQuestionTimer();
    }
  }

  function startPerQuestionTimer() {
    if (perQuestionInterval) clearInterval(perQuestionInterval);
    perQuestionSecondsLeft = secondsPerQuestion;
    perQuestionInterval = setInterval(() => {
      perQuestionSecondsLeft--;
      if (perQuestionSecondsLeft <= 0) advance();
    }, 1000);
  }

  function selectAnswer(idx: number) {
    answers[currentIndex] = idx;
    answers = [...answers];
  }

  function advance() {
    if (perQuestionInterval) { clearInterval(perQuestionInterval); perQuestionInterval = null; }
    if (currentIndex < queue.length - 1) {
      currentIndex++;
      if (timerMode === 'per-question') startPerQuestionTimer();
    } else {
      finishExam();
    }
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Results state ─────────────────────────────────────────
  let resultSession: ExamSession | null = null;
  let weakestSubject = '';

  async function finishExam() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (perQuestionInterval) { clearInterval(perQuestionInterval); perQuestionInterval = null; }

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    const subjectScores: Record<string, { correct: number; total: number }> = {};

    for (let i = 0; i < queue.length; i++) {
      const q = queue[i];
      const subjId = $subjects.find(s => s.name === q.subject)?.id ?? q.subject;
      if (!subjectScores[subjId]) subjectScores[subjId] = { correct: 0, total: 0 };
      subjectScores[subjId].total++;
      if (answers[i] === q.correctIndex) subjectScores[subjId].correct++;
    }

    const totalCorrect = Object.values(subjectScores).reduce((s, v) => s + v.correct, 0);

    const { userId, mode } = getAuthContext();
    const session: ExamSession = {
      id: db.newId(),
      userId,
      subjectScores,
      totalCorrect,
      totalQuestions: queue.length,
      durationSeconds,
      timerMode,
      createdAt: new Date().toISOString(),
    };

    await db.saveExamSession(session, mode);
    examSessions.update(all => [session, ...all]);
    resultSession = session;

    // find weakest subject by score ratio
    let worstRatio = 2;
    for (const [subjId, val] of Object.entries(subjectScores)) {
      const ratio = val.total > 0 ? val.correct / val.total : 0;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        weakestSubject = $subjects.find(s => s.id === subjId)?.name ?? subjId;
      }
    }

    phase = 'results';
  }

  function tryAgain() {
    phase = 'setup';
    resultSession = null;
    queue = [];
    answers = [];
  }

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
    if (perQuestionInterval) clearInterval(perQuestionInterval);
  });
</script>

{#if phase === 'setup'}
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Mock Exam</h1>
        <p class="page-sub">Configure your session</p>
      </div>
      <a href="/exam/questions" class="btn-secondary">Manage Questions →</a>
    </div>

    <div class="setup-card">

      <div class="section">
        <div class="section-label">Subjects</div>
        <div class="pill-group">
          {#each availableSubjects as s}
            <button class="pill" class:active={selectedSubjects.includes(s)} on:click={() => toggleSubject(s)}>{s}</button>
          {/each}
          {#if availableSubjects.length === 0}
            <span class="empty-hint">No questions in bank yet — <a href="/exam/questions">add some first</a></span>
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Difficulty</div>
        <div class="pill-group">
          {#each (['easy','medium','hard'] as const) as d}
            <button class="pill" class:active={selectedDifficulties.includes(d)} on:click={() => toggleDifficulty(d)}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="section-label">Questions per subject</div>
        <div class="number-row">
          <input class="number-input" type="number" min={1} bind:value={questionsPerSubject} disabled={useAllQuestions} />
          <label class="toggle-label">
            <input type="checkbox" bind:checked={useAllQuestions} /> use all available
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-label">Timer mode</div>
        <div class="timer-cards">

          <div class="timer-card" class:selected={timerMode === 'overall'} on:click={() => timerMode = 'overall'}>
            <div class="timer-card-title">Overall time limit</div>
            <div class="timer-card-sub">One countdown for the whole exam</div>
            {#if timerMode === 'overall'}
              <div class="number-row" style="margin-top:10px">
                <input class="number-input" type="number" min={1} bind:value={overallMinutes} disabled={noOverallLimit} />
                <span class="unit">minutes</span>
                <label class="toggle-label">
                  <input type="checkbox" bind:checked={noOverallLimit} /> no limit
                </label>
              </div>
            {/if}
          </div>

          <div class="timer-card" class:selected={timerMode === 'per-question'} on:click={() => timerMode = 'per-question'}>
            <div class="timer-card-title">Per question time limit</div>
            <div class="timer-card-sub">Each question has its own countdown — auto-advances on timeout</div>
            {#if timerMode === 'per-question'}
              <div class="number-row" style="margin-top:10px">
                <input class="number-input" type="number" min={5} bind:value={secondsPerQuestion} />
                <span class="unit">seconds per question</span>
              </div>
            {/if}
          </div>

        </div>
      </div>

      <div class="summary-line" class:warn={!canStart}>{summaryLine}</div>

      <button class="btn-start" disabled={!canStart} on:click={startExam}>Start Exam →</button>
    </div>
  </div>

{:else if phase === 'running' && current}
  <div class="page page-exam">

    <div class="exam-header">
      <div class="progress-label">Question {currentIndex + 1} / {queue.length}</div>
      {#if timerMode === 'overall' && !noOverallLimit}
        <div class="timer" class:urgent={overallSecondsLeft < 60}>⏱ {formatTime(overallSecondsLeft)}</div>
      {:else if timerMode === 'per-question'}
        <div class="timer" class:urgent={perQuestionSecondsLeft < 10}>⏱ {formatTime(perQuestionSecondsLeft)}</div>
      {/if}
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="width:{progressPct}%"></div>
    </div>

    <div class="question-card">
      <span class="subject-badge">{current.subject.toUpperCase()}</span>
      <p class="question-text">{current.text}</p>

      <div class="choices">
        {#each current.choices as choice, i}
          <button
            class="choice"
            class:selected={answers[currentIndex] === i}
            on:click={() => selectAnswer(i)}
          >
            <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
            {choice}
          </button>
        {/each}
      </div>

      <button
        class="btn-next"
        disabled={answers[currentIndex] === null}
        on:click={advance}
      >
        {currentIndex < queue.length - 1 ? 'Next →' : 'Finish Exam →'}
      </button>
    </div>
  </div>

{:else if phase === 'results' && resultSession}
  <div class="page">
    <div class="results-card">
      <div class="result-score">
        {resultSession.totalCorrect}<span class="result-denom">/{resultSession.totalQuestions}</span>
      </div>
      <div class="result-sub">Mock Exam · {Math.round(resultSession.durationSeconds / 60)} min</div>

      <div class="breakdown">
        {#each Object.entries(resultSession.subjectScores) as [subjId, val]}
          {@const subj = $subjects.find(s => s.id === subjId)}
          {@const pct = val.total > 0 ? (val.correct / val.total) * 100 : 0}
          <div class="breakdown-row">
            <span class="breakdown-label">{subj?.name ?? subjId}</span>
            <div class="breakdown-bar">
              <div class="breakdown-fill" style="width:{pct}%;background:{subj?.color ?? 'var(--primary)'}"></div>
            </div>
            <span class="breakdown-score">{val.correct}/{val.total}</span>
          </div>
        {/each}
      </div>

      {#if weakestSubject}
        <div class="weakest">
          Weakest area: <strong>{weakestSubject}</strong> —
          <a href="/review">review SRS cards</a>
        </div>
      {/if}

      <div class="result-actions">
        <button class="btn-primary" on:click={tryAgain}>Try again</button>
        <a href="/dashboard" class="btn-secondary">Back to dashboard</a>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .page-exam { max-width: 560px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .page-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 2px; }
  .page-sub { font-size: 13px; color: var(--muted); margin: 0; }
  .btn-primary { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-secondary { background: var(--bg2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 8px 14px; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-block; }

  /* Setup */
  .setup-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .section-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
  .pill-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { background: var(--bg3); border: 1px solid var(--border); color: var(--muted); border-radius: 20px; padding: 6px 14px; font-size: 12px; cursor: pointer; }
  .pill.active { background: var(--primary-l); border-color: var(--primary); color: var(--primary); font-weight: 600; }
  .empty-hint { font-size: 12px; color: var(--muted); }
  .empty-hint a { color: var(--primary); }
  .number-row { display: flex; align-items: center; gap: 10px; }
  .number-input { width: 72px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 14px; font-weight: 600; color: var(--text); text-align: center; }
  .number-input:disabled { opacity: 0.4; }
  .unit { font-size: 13px; color: var(--muted); }
  .toggle-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); cursor: pointer; }
  .timer-cards { display: flex; flex-direction: column; gap: 10px; }
  .timer-card { border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; }
  .timer-card.selected { border-color: var(--primary); background: var(--primary-l); }
  .timer-card-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .timer-card-sub { font-size: 11px; color: var(--muted); }
  .summary-line { font-size: 12px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; }
  .summary-line.warn { color: #ef4444; }
  .btn-start { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 12px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; }
  .btn-start:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Running */
  .exam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .progress-label { font-size: 13px; color: var(--muted); }
  .timer { font-size: 15px; font-weight: 600; color: var(--primary); }
  .timer.urgent { color: #ef4444; }
  .progress-bar { height: 4px; background: var(--border); border-radius: 2px; margin-bottom: 24px; }
  .progress-fill { height: 100%; background: var(--primary); border-radius: 2px; transition: width 0.3s; }
  .question-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 24px; }
  .subject-badge { display: inline-block; background: var(--primary-l); color: var(--primary); font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 10px; letter-spacing: .5px; margin-bottom: 12px; }
  .question-text { font-size: 15px; font-weight: 500; color: var(--text); line-height: 1.5; margin: 0 0 20px; }
  .choices { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
  .choice { display: flex; align-items: center; gap: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 14px; font-size: 14px; color: var(--text); cursor: pointer; text-align: left; }
  .choice.selected { border-color: var(--primary); background: var(--primary-l); color: var(--text); }
  .choice .choice-letter { font-weight: 700; color: var(--muted); font-size: 13px; flex-shrink: 0; }
  .choice.selected .choice-letter { color: var(--primary); }
  .btn-next { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; }
  .btn-next:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Results */
  .results-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 24px; text-align: center; }
  .result-score { font-size: 56px; font-weight: 700; color: var(--primary); line-height: 1; }
  .result-denom { font-size: 24px; font-weight: 400; color: var(--muted); }
  .result-sub { font-size: 13px; color: var(--muted); margin-top: 4px; margin-bottom: 24px; }
  .breakdown { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; text-align: left; }
  .breakdown-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .breakdown-label { width: 80px; color: var(--muted); flex-shrink: 0; }
  .breakdown-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .breakdown-fill { height: 100%; border-radius: 3px; }
  .breakdown-score { width: 40px; text-align: right; font-weight: 600; color: var(--text); }
  .weakest { font-size: 13px; color: var(--muted); background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; text-align: left; }
  .weakest strong { color: var(--text); }
  .weakest a { color: var(--primary); }
  .result-actions { display: flex; gap: 10px; justify-content: center; }
</style>
```

- [ ] **Step 2: Type-check**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 3: Start dev server and manually test the full exam flow**

```bash
npm run dev
```

Checklist:
- Navigate to `/exam` — setup screen renders
- With no questions: "No questions match" warning, Start button disabled
- Go to `/exam/questions`, add 3+ questions for 2 subjects
- Return to `/exam`, select subjects + difficulties, configure timer
- Click Start — running screen shows
- Click an answer — it highlights in primary colour
- Click Next — advances to next question
- Finish all questions — results screen shows with score breakdown
- "Try again" returns to setup
- "Back to dashboard" navigates to `/dashboard`

- [ ] **Step 4: Test per-question timer mode**

Add a question, start exam with per-question mode set to 5 seconds. Verify question auto-advances after 5 seconds without selecting an answer.

- [ ] **Step 5: Commit**

```bash
git add src/routes/(app)/exam/+page.svelte
git commit -m "feat(exam): add mock exam page with setup, running, and results phases"
```

---

## Task 8: Readiness score card on dashboard

**Files:**
- Create: `src/lib/components/ReadinessCard.svelte`
- Modify: `src/routes/(app)/dashboard/+page.svelte`

- [ ] **Step 1: Create `src/lib/components/ReadinessCard.svelte`**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { readinessScore, subjects } from '$lib/stores/data';
</script>

<div class="card">
  <div class="card-header">
    <span class="card-label">Exam Readiness</span>
  </div>

  <div class="score-big">{$readinessScore.overall}<span class="score-pct">%</span></div>

  <div class="pills">
    {#each $subjects as subj (subj.id)}
      {@const score = $readinessScore.bySubject[subj.id] ?? 0}
      <div class="pill">
        <span class="pill-name">{subj.name}</span>
        <span class="pill-score" style="color:{subj.color}">{score}%</span>
      </div>
    {/each}
    {#if $subjects.length === 0}
      <span class="no-data">Add subjects to see readiness</span>
    {/if}
  </div>

  <button class="start-btn" on:click={() => goto('/exam')}>Start Mock Exam →</button>
</div>

<style>
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-label { font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .score-big { font-size: 52px; font-weight: 700; color: var(--primary); line-height: 1; }
  .score-pct { font-size: 22px; font-weight: 400; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; font-size: 11px; display: flex; gap: 6px; align-items: center; }
  .pill-name { color: var(--muted); }
  .pill-score { font-weight: 600; }
  .no-data { font-size: 12px; color: var(--muted); }
  .start-btn { background: var(--primary); color: var(--bg); border: none; border-radius: var(--radius-md); padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; align-self: flex-start; }
</style>
```

- [ ] **Step 2: Add `ReadinessCard` import to dashboard**

In `src/routes/(app)/dashboard/+page.svelte`, add to the script imports:

```ts
import ReadinessCard from '$lib/components/ReadinessCard.svelte';
```

- [ ] **Step 3: Add `ReadinessCard` to the dashboard template**

In the dashboard template, add `<ReadinessCard />` after the existing stat cards (the exact position depends on the current card grid — place it alongside `HeroCard` components or in the cards section).

Find where HeroCards or stat cards are rendered and add below them:

```svelte
<ReadinessCard />
```

- [ ] **Step 4: Type-check**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 5: Start dev server and verify readiness card appears on dashboard**

```bash
npm run dev
```

Check:
- Card appears on dashboard with `0%` before any exam sessions
- After running a mock exam, overall % updates
- "Start Mock Exam →" button navigates to `/exam`
- Subject pills show per-subject scores

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ReadinessCard.svelte src/routes/(app)/dashboard/+page.svelte
git commit -m "feat(exam): add readiness score card to dashboard"
```

---

## Task 9: Update CLAUDE.md Active Plans

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Move the exam plan from Open → Completed in `CLAUDE.md`**

In the `### Open (ready to implement)` section, remove:
```
- `docs/superpowers/plans/2026-05-28-exam-simulation.md` — Exam Simulation feature
```

In the `### Completed` section, add:
```
- `docs/superpowers/plans/2026-05-28-exam-simulation.md` — Exam Simulation (readiness score, question bank, mock exam)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark exam simulation plan as completed"
```
