# Pulse Social v2 — Design Spec

> Builds on Pulse Social v1 (`2026-06-22-pulse-social-groups-v1-design.md`). Auth-only; guest sees the existing sign-in prompt. All date math in Asia/Bangkok; week starts Monday. No hardcoded hex; i18n in both `en.ts` + `th.ts`. Implementation handed to Codex; Claude orchestrates/verifies. Every migration/RPC to prod needs explicit user go-ahead.

**Goal:** Make groups configurable, show who's studying live, make both import flows user-adjustable, and add an async exam challenge with a score leaderboard.

## Existing schema (v1, confirmed live)

- `study_groups(id, owner_id, name, invite_code, created_at)`
- `group_members(id, group_id, user_id, role['member'], status['pending'|'approved'], visible[bool=true], created_at, approved_at)`
- `group_shares(id, group_id, shared_by, kind['flashcard_deck'|'exam_set'], title, payload jsonb, created_at)`
- Public RPCs: `create_group(p_name)`, `join_group(p_invite_code)`, `approve_member`, `remove_member`, `leave_group`, `rename_group`, `delete_group`, `list_my_groups`, `get_group_leaderboard`
- Private helpers: `is_group_member`, `is_group_owner`, `user_streak`
- Client: `src/lib/groups.ts`; routes `/groups` + `/groups/[id]`; components in `src/lib/components/groups/`.

---

## Phase 1 — Configurable group settings *(prod migration)*

**Columns added to `study_groups`:**
- `join_policy text not null default 'approval'` — `'approval'` (current behaviour, existing rows unchanged) or `'open'` (code grants instant membership).
- `share_policy text not null default 'members'` — `'members'` (any approved member may share) or `'owner'` (owner only).
- `description text` (nullable, ≤280 chars enforced client-side + a check constraint).
- `icon text` (nullable, single emoji, ≤8 chars).
- `member_cap int` (nullable = unlimited).

**RPC changes:**
- `join_group(p_invite_code)`: read the group's `join_policy` + `member_cap`. If approved-member count ≥ `member_cap`, `raise exception 'group_full'`. If `join_policy='open'`, insert membership with `status='approved', approved_at=now()`; else `status='pending'` (current). Returns enough for the client to know whether it's joined or pending.
- New `update_group_settings(p_group_id, p_name, p_description, p_icon, p_join_policy, p_share_policy, p_member_cap)` — owner-only (`private.is_group_owner`), validates enums + lengths, updates the row. Supersedes `rename_group` for the settings panel (keep `rename_group` for back-compat).
- `list_my_groups` + `get_group_leaderboard`: also return the new fields + an approved-member count so the UI can render cap/usage.

**RLS:** `group_shares` INSERT policy gains a share-policy gate — when `share_policy='owner'`, only the owner may insert (uses `private.is_group_owner`); otherwise any approved member (current rule). Member cap is enforced in the RPC, not RLS.

**Client / UI:** `src/lib/groups.ts` gains `updateGroupSettings(...)` and extends the `GroupSummary` type with the new fields. The **Manage** tab (owner-only) gets a settings panel: name, description, emoji icon, join-policy toggle, share-policy toggle, member cap. The join flow surfaces "joined" vs "request sent" based on the RPC result. `/groups` create form optionally accepts description + icon.

---

## Phase 2 — Live presence "studying now" *(no migration — pure Realtime)*

Supabase **Realtime Presence**, one channel per group (`group-presence:{groupId}`). No DB writes — presence state is ephemeral.

- **New setting** `shareActivity: boolean` (default **on**) in `src/lib/stores/settings.ts` + a toggle in `/settings`. When off, the client tracks nothing on any presence channel (you appear offline to groups).
- **New module** `src/lib/presence.ts`: when authenticated + `shareActivity` on, for each of the user's approved groups, join its presence channel and `track({ userId, name, status })` where `status ∈ 'idle' | 'studying' | 'exam'`. Status is derived from the timer store (`status==='running'` → `studying`) and an exam-in-progress flag; updates re-`track()` on change. Channels are created lazily and torn down on logout / setting-off / group-leave.
- **Group page** subscribes to that group's channel and renders, per member row, a live dot + label (`studying` green, `exam` amber, `idle`/absent grey). Reuses CSS tokens (`--primary`, `--warning`, `--muted`); no hardcoded hex.
- Presence is layered onto the existing leaderboard rows (a dot on `LeaderboardRow`), not a separate tab.

**Privacy:** `shareActivity` off ⇒ no `track()` at all ⇒ invisible. Independent of the v1 per-group `visible` flag (which governs leaderboard listing).

---

## Phase 3 — Adjustable imports *(no migration)*

**3a — AI prompt generator (`src/lib/import.ts`).** The prompt builders already accept `count` / `difficulty`; the call sites hardcode them. Surface UI controls wherever a prompt is generated (subject template, flashcard deck, exam set): a count input, a difficulty selector (exam), a language choice (default: same language as the source name — keep current behaviour as the default option), and an optional free-text **focus** note appended to the prompt ("focus on …"). Extend the prompt builders to take `language?` and `focus?` and weave them into the rules. Pure client, no schema.

**3b — Group share import (`importShare`).** Replace auto-create-everything with a **preview + options** flow. "Add to my account" opens a sheet showing the deck/exam contents with:
- **Target** — pick an existing subject *or* create a new one (prefilled name, editable). For exam sets, target is optional (questions carry their own `subject` tag).
- **Title** — editable.
- **Selection** — checkbox each card/question (default all selected).

`importShare(share, opts)` takes `{ targetSubjectId?, newSubjectName?, title?, selectedIndices: number[] }` and imports only the chosen items into the chosen target. Existing name-dedupe stays as the fallback when no target is chosen.

---

## Phase 4 — Async exam challenge *(prod migration)*

A challenge = an exam set posted to a group that members take on their own time; scores compare on a leaderboard. Full live/Kahoot is out of scope (future spec).

**New tables:**
- `group_challenges(id, group_id, created_by, title, payload jsonb, created_at)` — `payload` is the same `ExamSetSnapshot` shape as `group_shares` (`{title, questions:[{text,choices,correctIndex,subject,difficulty,year}]}`). RLS: members of the group read; any approved member (gated by `share_policy` like shares) inserts own; creator/owner delete.
- `challenge_results(id, challenge_id, user_id, score int, total int, taken_at)` — one best/last result per `(challenge_id, user_id)` (unique constraint; upsert). RLS: members of the parent group read all results; user inserts/updates own (`user_id = auth.uid()`).

**RPCs:** `post_challenge(p_group_id, p_title, p_payload)`; `submit_challenge_result(p_challenge_id, p_score, p_total)` (validates the user is an approved member of the challenge's group, upserts); `get_challenge_results(p_challenge_id)` returns `{userId, name, score, total, takenAt}` for ranking. Reuse `private.is_group_member`.

**Client / UI:** `src/lib/groups.ts` (or a new `src/lib/challenges.ts`) gains the wrappers + types. A **Challenges** tab on `/groups/[id]`: list challenges, "New challenge" (pick one of your exam sets → `post_challenge`), "Take" (runs the existing exam runner over the snapshot, then `submit_challenge_result`), and a per-challenge results leaderboard. Taking a challenge must reuse the existing exam-session UI without polluting the user's personal `exam_sessions` history (run it in a transient/scoped mode).

---

## Phasing & process

Ship in order, each phase its own PR so the user can try each as it lands:

1. Configurable settings (migration) → 2. Live presence (Realtime) → 3a/3b adjustable imports → 4. Async challenge (migration).

Claude writes spec + plan and orchestrates; **Codex implements each task** via `codex exec`, Claude reviews diffs + runs `npm run check` + browser-verifies. The plan carries a "continue from here" brief so work can resume on `/codex:rescue` if Claude hits a usage limit. Migrations (Phases 1 & 4) are applied to prod **only** with explicit user go-ahead.

## Out of scope (future specs)

- Live Kahoot-style synchronized quiz.
- Standalone Notes entity + note sharing.
- Marketplace / public packs / Pulse Pro.
