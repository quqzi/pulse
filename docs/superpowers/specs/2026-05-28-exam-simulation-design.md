# Exam Simulation — Design Spec

**Date:** 2026-05-28  
**Status:** Approved  
**Scope:** Readiness Score card + Question Bank + Mock Exam (core feature)  
**Out of scope:** Pulse MCP Server (separate feature, backlog)

---

## Overview

Three connected pieces that give TCAS students a way to measure and test their exam readiness inside Pulse.

1. **Readiness Score** — always-visible score on the dashboard derived from existing study data
2. **Question Bank** — a library of multiple-choice questions the user builds and manages
3. **Mock Exam** — a configurable timed exam session that draws from the question bank and feeds results back into the readiness score

---

## Piece 1 — Readiness Score Card (Dashboard)

A new card added to the dashboard page alongside existing stat cards.

### Layout
- Big readiness percentage (e.g. `74%`) as the focal point
- Subject pills below showing per-subject scores (e.g. `Math 82%`, `Thai 71%`)
- "Start Mock Exam →" button at the bottom of the card

### Score formula
Weighted average across all subjects the user has data for:

```
subjectScore = (srsWeight × srsScore) + (hoursWeight × hoursScore) + (examWeight × examScore)
```

- **SRS score** (40%) — % of SRS cards for that subject with `ease ≥ 2.5` (mastered)
- **Hours score** (30%) — hours studied this subject in the last 30 days, normalised to 100% at 20 hours (capped at 100%)
- **Exam score** (30%) — average mock exam score for that subject (0 if no exams taken yet)

Overall readiness = average of all subject scores, weighted by number of topics per subject.

Score is computed client-side from existing store data on every dashboard mount. No new DB column needed.

---

## Piece 2 — Question Bank (`/exam/questions`)

New page in the sidebar under the **Track** group. New sidebar entry: `{ label: 'Exam', href: '/exam', d: '<svg path>' }`.

The question bank page lives at `/exam/questions`. The exam setup/run page lives at `/exam`.

### Data model

```ts
interface ExamQuestion {
  id: string
  userId: string
  text: string
  choices: [string, string, string, string]   // always 4
  correctIndex: 0 | 1 | 2 | 3               // index into choices
  subject: string                             // matches existing subject names
  difficulty: 'easy' | 'medium' | 'hard'
  year?: number                               // optional — for past paper tagging later
  createdAt: string
}
```

Guest mode: stored in localStorage as `pulse_exam_questions`.  
Auth mode: new Supabase table `exam_questions` with `user_id` RLS.

### UI — Question list
- Search input filters by question text
- Subject filter dropdown
- Each row shows: truncated question text, subject pill, difficulty pill, optional year pill, Edit + Delete actions
- "Add" button opens the add form (same page, right panel or modal)

### UI — Add/Edit form
- Textarea for question text
- Four text inputs for choices A/B/C/D
- Click a circle next to a choice to mark it as correct (radio-style, filled circle = correct)
- Subject dropdown (populated from existing subjects store)
- Difficulty select: Easy / Medium / Hard
- Year input (optional, placeholder "e.g. 2024")
- Save button

---

## Piece 3 — Mock Exam (`/exam`)

### Setup screen

Shown when navigating to `/exam` with no active session.

| Control | Behaviour |
|---|---|
| Subjects | Multi-select pill toggle — any combination |
| Difficulty | Multi-select — Easy / Medium / Hard, any combination |
| Questions per subject | Free number input + "use all available" toggle |
| Timer mode | Radio: **Overall** or **Per question** |
| Overall mode | Free minutes input + "no limit" toggle |
| Per-question mode | Free seconds input per question |

A summary line updates live: `"30 questions · Math + Thai · Medium + Hard · 45 min overall"`.

Questions are sampled randomly from the bank matching the selected subjects + difficulties. If fewer questions exist than requested, all matching questions are used. If zero questions match the selection, the Start button is disabled and a message reads "No questions found for this selection — add questions first."

### Exam in progress

- Progress bar at top: `Question 7 / 30`
- Timer: overall countdown in top-right, or per-question countdown that resets on each question
- Per-question mode: auto-advances to next question when timer hits zero (counts as unanswered)
- Subject badge above each question (e.g. `MATH`)
- Question text
- Four answer choices — clicking one highlights it in `--primary` colour
- "Next →" button advances (disabled until a choice is selected, unless timer auto-advances)
- No going back to previous questions

### Results screen

Shown immediately after the last question.

- Overall score: `16 / 30`
- Per-subject breakdown: horizontal bar per subject showing score
- Weakest subject/topic callout: "Weakest area: Thai Reading Comprehension — review SRS cards" (links to `/review`)
- Exam session saved to store + Supabase (`exam_sessions` table)
- "Try again" and "Back to dashboard" buttons

### Exam session data model

```ts
interface ExamSession {
  id: string
  userId: string
  subjectScores: Record<string, { correct: number; total: number }>
  totalCorrect: number
  totalQuestions: number
  durationSeconds: number
  timerMode: 'overall' | 'per-question'
  createdAt: string
}
```

Guest mode: `pulse_exam_sessions` in localStorage.  
Auth mode: `exam_sessions` table in Supabase with `user_id` RLS.

---

## New Supabase Tables

### `exam_questions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `auth.users` | RLS: `auth.uid() = user_id` |
| `text` | `text` NOT NULL | |
| `choices` | `text[4]` | Array of 4 strings |
| `correct_index` | `smallint` | 0–3 |
| `subject` | `text` NOT NULL | |
| `difficulty` | `text` NOT NULL | `'easy' \| 'medium' \| 'hard'` |
| `year` | `smallint` | nullable |
| `created_at` | `timestamptz` | default `now()` |

### `exam_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `auth.users` | RLS: `auth.uid() = user_id` |
| `subject_scores` | `jsonb` | `{ Math: { correct: 9, total: 10 } }` |
| `total_correct` | `smallint` | |
| `total_questions` | `smallint` | |
| `duration_seconds` | `int` | |
| `timer_mode` | `text` | `'overall' \| 'per-question'` |
| `created_at` | `timestamptz` | default `now()` |

---

## Store additions (`data.ts`)

```ts
export const examQuestions = writable<ExamQuestion[]>([])
export const examSessions  = writable<ExamSession[]>([])
```

Both populated inside `loadData()`. Readiness score is `$derived` from `examQuestions`, `examSessions`, `srsCards`, and `sessions`.

---

## Navigation

- Sidebar entry added to **Track** group: `Exam` → `/exam`
- `/exam` → setup screen (or active session if one is in progress)
- `/exam/questions` → question bank

---

## Future: Pulse MCP Server (out of scope)

After the core exam feature ships, expose Pulse as an MCP server so users can connect their own AI agents (Claude Desktop, Cursor, etc.) via a per-user API token. Tools: `add_question`, `list_questions`, `delete_question_by_id`, `get_readiness_score`. Supabase RLS as security backstop. Per-user tokens generated in Settings, revocable at any time.
