# Pulse Social v2 — Implementation Plan

> **For agentic workers:** Implementation is handed to **Codex** task-by-task (`codex exec`); Claude reviews each diff, runs `npm run check`, and browser-verifies. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Configurable groups, live "studying now" presence, adjustable AI + share imports, and an async exam challenge with score leaderboard.

**Architecture:** Extends Pulse Social v1. New columns/RPCs on the existing groups schema (Phases 1 & 4 = prod migrations), Supabase Realtime Presence for live status (Phase 2, no DB), pure-client work for adjustable imports (Phase 3).

**Tech Stack:** SvelteKit 2 + TypeScript (Svelte 4 idiom), Supabase (Postgres + RLS + RPC + Realtime), plain CSS tokens.

## Global Constraints

- Auth-only — guest sees the existing sign-in prompt. Never call group RPCs in guest mode.
- All date/week math in **Asia/Bangkok**, week starts **Monday**. Never `toISOString()` for date-only.
- No hardcoded hex — CSS tokens or `getComputedStyle(document.body)`. No `transition: width/height`.
- i18n keys in **both** `src/lib/i18n/en.ts` and `th.ts` under `groups.*` / `settings.*`.
- SECURITY DEFINER helper functions used in RLS live in the **`private`** schema (not `public`). New public RPCs: grant EXECUTE to `authenticated` only; **revoke from `anon`** explicitly (Supabase grants it directly).
- `repo.save/remove` write through to the bound store — never also `.set()`.
- `npm run check` must be 0 errors / 0 warnings before each task is accepted.
- **Migrations + RPCs are production actions** — Claude applies them only after explicit user go-ahead. Codex never applies a migration.

---

## Phase 1 — Configurable group settings

### Task 1.1: Migration — columns + updated join_group + update_group_settings *(Claude applies to prod)*

**Files:** Supabase migration `social_v2_group_settings`.

- [ ] Add columns to `study_groups`: `join_policy text not null default 'approval' check (join_policy in ('approval','open'))`, `share_policy text not null default 'members' check (share_policy in ('members','owner'))`, `description text check (char_length(description) <= 280)`, `icon text check (char_length(icon) <= 8)`, `member_cap int check (member_cap is null or member_cap > 0)`.
- [ ] Replace `public.join_group(p_invite_code text)`: resolve group; if approved-member count ≥ `member_cap` → `raise exception 'group_full'`; if `join_policy='open'` insert `status='approved', approved_at=now()` else `status='pending'`; idempotent on existing membership; return `table(group_id uuid, status text)`. SECURITY DEFINER, `search_path=public`.
- [ ] Create `public.update_group_settings(p_group_id uuid, p_name text, p_description text, p_icon text, p_join_policy text, p_share_policy text, p_member_cap int)` — owner-only via `private.is_group_owner(p_group_id, auth.uid())`, validate enums + lengths, `update study_groups set ...`. SECURITY DEFINER.
- [ ] Update `public.list_my_groups()` and `public.get_group_leaderboard(p_group_id)` to also return `description, icon, join_policy, share_policy, member_cap` and an approved `member_count`.
- [ ] Update the `group_shares` INSERT RLS policy: allow when membership approved AND (`share_policy='members'` OR `private.is_group_owner(group_id, auth.uid())`).
- [ ] `grant execute on function public.update_group_settings(...) to authenticated; revoke execute on function public.update_group_settings(...) from anon;` (and re-apply the same grant/revoke for the replaced `join_group`).
- [ ] **Verify:** `get_advisors` shows no new `anon_security_definer_function_executable` (0028) findings.

### Task 1.2: groups.ts — settings wrappers + extended types

**Files:** Modify `src/lib/groups.ts`.

- [ ] Extend `GroupSummary` with `description: string | null; icon: string | null; joinPolicy: 'approval'|'open'; sharePolicy: 'members'|'owner'; memberCap: number | null; memberCount: number`. Map them in `loadMyGroups` / wherever `list_my_groups` + `get_group_leaderboard` rows are read.
- [ ] Add `updateGroupSettings(groupId, fields)` calling the RPC; on success refresh `myGroups`. Toast on error.
- [ ] Update `joinGroup` to read the RPC's returned `status` and return it so the page can show "joined" vs "request sent".
- [ ] `npm run check` clean.

### Task 1.3: UI — owner settings panel + join feedback + create-form fields

**Files:** Modify `src/routes/(app)/groups/[id]/+page.svelte` (Manage tab), `src/routes/(app)/groups/+page.svelte` (create/join), i18n `en.ts`/`th.ts`. Optionally a new `src/lib/components/groups/GroupSettingsForm.svelte`.

- [ ] Manage tab (owner-only): edit name, description (≤280, counter), emoji icon, join-policy toggle, share-policy toggle, member cap (number, blank = unlimited). Save → `updateGroupSettings`.
- [ ] Show icon + description + member count/cap on `GroupCard` and the group header.
- [ ] Join flow shows "Joined!" (open) vs "Request sent" (approval) from the returned status. Create form optionally accepts description + icon.
- [ ] New i18n keys (both languages). `npm run check` clean; browser-verify open vs approval join + a settings edit.

---

## Phase 2 — Live presence "studying now"

### Task 2.1: shareActivity setting + toggle

**Files:** Modify `src/lib/stores/settings.ts` (interface + `defaults()` → `shareActivity: true`), `src/routes/(app)/settings/+page.svelte` (toggle under privacy/social), i18n.

- [ ] Add `shareActivity: boolean` default `true`; add the toggle control; i18n both languages. `npm run check` clean.

### Task 2.2: presence module

**Files:** Create `src/lib/presence.ts`. Read `src/lib/timer.ts`/`stores/timer.ts` for the running flag and `src/lib/groups.ts` `myGroups` + `getAuthContext`.

- [ ] Export `startPresence()` / `stopPresence()`. When authenticated AND `shareActivity` on: for each approved group in `myGroups`, join channel `group-presence:{groupId}` and `track({ userId, name, status })`, `status: 'idle'|'studying'|'exam'` derived from the timer store (running → `studying`) + an exam-in-progress signal; re-`track()` on status change; subscribe to `myGroups` changes to add/remove channels.
- [ ] Tear down all channels on logout, `shareActivity` off, or group leave. Idempotent; no leaks (untrack + removeChannel).
- [ ] Wire `startPresence()`/`stopPresence()` into the app shell (`src/routes/(app)/+layout.svelte`) reacting to auth + `shareActivity`.
- [ ] `npm run check` clean.

### Task 2.3: render live dots on the group page

**Files:** Modify `src/routes/(app)/groups/[id]/+page.svelte` + `src/lib/components/groups/LeaderboardRow.svelte`.

- [ ] On the group page subscribe to `group-presence:{id}`, build a `Map<userId, status>` from presence state, pass to each `LeaderboardRow`.
- [ ] `LeaderboardRow` shows a status dot + label: `studying`=`--primary`/green token, `exam`=`--warning`, else muted/hidden. Tokens only.
- [ ] i18n labels both languages. `npm run check` clean; browser-verify two sessions (start a timer in one → dot turns "studying" in the other; toggle `shareActivity` off → disappears).

---

## Phase 3 — Adjustable imports

### Task 3.1: AI prompt builders take language + focus

**Files:** Modify `src/lib/import.ts`.

- [ ] Add optional `language?: string` and `focus?: string` to `templatePrompt`, `flashcardPrompt`, `examPrompt`; when set, add rules ("Write in {language}." / "Focus on: {focus}."). Default behaviour unchanged when omitted. Keep existing params.
- [ ] `npm run check` clean.

### Task 3.2: surface count/difficulty/language/focus controls in the prompt UI

**Files:** Codex must locate the prompt call sites (grep `templatePrompt`/`flashcardPrompt`/`examPrompt`) — likely subjects/flashcards/exam pages or an import component. Modify those + i18n.

- [ ] Add controls next to each "copy prompt" action: count (number), difficulty selector (exam only), language (default = "same as source", an option list), optional focus text. Feed into the builders.
- [ ] New i18n keys both languages. `npm run check` clean; browser-verify the generated prompt text reflects the controls.

### Task 3.3: share import preview + options sheet

**Files:** Modify `src/lib/groups.ts` (`importShare` signature), `src/lib/components/groups/ShareItemCard.svelte`, new `src/lib/components/groups/ImportShareSheet.svelte` (BottomSheet, portal to body), i18n.

- [ ] `importShare(share, opts)` with `opts: { targetSubjectId?: string; newSubjectName?: string; title?: string; selectedIndices: number[] }`; import only selected items into the chosen target; current name-dedupe is the fallback when no target chosen. Keep write-through (no double `.set()`).
- [ ] "Add to my account" opens `ImportShareSheet`: preview contents, target picker (existing subject or new/rename), editable title, per-item checkboxes (default all). Confirm → `importShare(share, opts)` → success toast.
- [ ] New i18n keys both languages. `npm run check` clean; browser-verify importing a subset into an existing subject.

---

## Phase 4 — Async exam challenge

### Task 4.1: Migration — challenge tables + RPCs *(Claude applies to prod)*

**Files:** Supabase migration `social_v2_challenges`.

- [ ] `create table public.group_challenges(id uuid pk default gen_random_uuid(), group_id uuid not null references study_groups(id) on delete cascade, created_by uuid not null, title text not null, payload jsonb not null, created_at timestamptz not null default now())`. Enable RLS. Policies: SELECT when `private.is_group_member(group_id, auth.uid())`; INSERT when approved member AND (`share_policy='members'` OR owner) AND `created_by = auth.uid()`; DELETE when `created_by = auth.uid()` OR `private.is_group_owner(group_id, auth.uid())`. Index on `group_id`.
- [ ] `create table public.challenge_results(id uuid pk default gen_random_uuid(), challenge_id uuid not null references group_challenges(id) on delete cascade, user_id uuid not null, score int not null, total int not null, taken_at timestamptz not null default now(), unique(challenge_id, user_id))`. Enable RLS. Policies: SELECT when member of the challenge's group; INSERT/UPDATE when `user_id = auth.uid()` AND approved member of the group. Index on `challenge_id`.
- [ ] RPCs (SECURITY DEFINER, `private.is_group_member` gated): `post_challenge(p_group_id uuid, p_title text, p_payload jsonb)`; `submit_challenge_result(p_challenge_id uuid, p_score int, p_total int)` (upsert on the unique key); `get_challenge_results(p_challenge_id uuid)` returns `table(user_id uuid, name text, score int, total int, taken_at timestamptz)`.
- [ ] `grant execute ... to authenticated; revoke execute ... from anon;` for all three RPCs.
- [ ] **Verify:** `get_advisors` shows no new 0028 findings.

### Task 4.2: challenges client wrappers

**Files:** Modify `src/lib/groups.ts` (or new `src/lib/challenges.ts`).

- [ ] Types `GroupChallenge`, `ChallengeResult`; wrappers `listChallenges(gid)`, `postChallenge(gid, examSetPayload, title)` (reuse the `ExamSetSnapshot` builder from `shareExamSet`), `submitChallengeResult(challengeId, score, total)`, `getChallengeResults(challengeId)`. Toast on error.
- [ ] `npm run check` clean.

### Task 4.3: Challenges tab UI + transient exam runner

**Files:** Modify `src/routes/(app)/groups/[id]/+page.svelte`; new components `src/lib/components/groups/ChallengeCard.svelte`, `ChallengeResults.svelte`; reuse the exam runner. Read the existing exam route/runner to reuse it without writing to the user's `exam_sessions`.

- [ ] Challenges tab: list challenges (ChallengeCard), "New challenge" picks one of the user's exam sets → `postChallenge`, "Take" runs the snapshot through the existing exam-runner UI in a **transient mode** (no personal `exam_sessions` write), then `submitChallengeResult(score, total)`.
- [ ] Per-challenge results leaderboard (ChallengeResults) ranked by score then time. Empty states per the standard pattern.
- [ ] New i18n keys both languages. `npm run check` clean; browser-verify post → take → result appears ranked.

---

## Continue-from-here brief (if Claude hits a usage limit)

Hand the next unchecked task to Codex with: *"Read `docs/superpowers/plans/2026-06-22-pulse-social-v2.md`, implement the next unchecked task only, obey the Global Constraints, verify against real code (schema/RPCs are live on Supabase project `bzcanpehaoeminjbzpvq`), run `npm run check` to 0/0, do NOT git commit, do NOT apply migrations, and report files changed + the check result line."* Claude then reviews the diff, commits, and (for migration tasks) applies to prod only with the user's go-ahead.

## Verification

- `npm run check` 0/0 after every task; `npx vitest run` stays green.
- Phase 1: open-group join is instant; approval-group still queues; member cap blocks; owner-only share enforced; settings persist.
- Phase 2: timer running in account A shows a live "studying" dot in account B's group view; `shareActivity` off hides it.
- Phase 3: prompt text reflects count/difficulty/language/focus; share import lets you choose target + subset.
- Phase 4: post a challenge, take it, score lands on the results leaderboard; personal exam history untouched.
- Browser-verify each phase (mobile 390px + desktop), EN + TH, across all five themes for any new UI.
