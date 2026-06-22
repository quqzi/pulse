# Pulse Social — Study Groups v1 (Groups + Leaderboard + Sharing)

**Date:** 2026-06-22
**Status:** Approved design — ready for implementation plan
**Author:** brainstorming session (Claude + user)

## Context

Real users are on Pulse. The user wants a YPT-style social layer: study groups where members
see each other's progress and share study material. The full vision spans five subsystems
(see Roadmap below); this spec covers **v1 only**: group membership, a weekly leaderboard, and
content sharing for the two self-contained content types that already exist (flashcard decks and
exam question sets).

Pulse is SvelteKit 2 + TypeScript + Supabase, dual-mode (guest = localStorage `pulse.*`;
authenticated = Supabase with RLS `auth.uid() = user_id`). Aggregates (total hours, streak,
achievements) are currently computed **client-side** from raw `study_sessions`
(`src/lib/stores/data.ts` derived stores, `src/lib/achievements.ts`).

## Goals

- Authenticated users can create a group, invite by code, and approve joiners.
- A group leaderboard ranks members by **weekly study hours**, with **current streak** as a
  secondary badge.
- Members can **share** a flashcard deck or an exam question set into a group; other members can
  **import** it into their own account.
- Raw private data (`study_sessions`, scores, a sharer's live decks) is **never** exposed
  cross-user — only aggregates and explicitly-published snapshots cross the user boundary.

## Non-Goals (explicitly out of v1)

- **Notes** — a standalone note-taking feature, deferred to its own spec immediately after this
  one. Shared notes will be added to the sharing layer once Notes exists.
- **Live study presence** ("who's studying now" + live timers) — separate spec; needs Supabase
  Realtime and a stronger privacy design.
- **Marketplace** — far-future, builds on the sharing layer.
- **Guest participation** — groups are auth-only. Guests see a sign-in prompt.
- Avatars/photos — members are shown as display name + colored initial.

## Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Leaderboard ranking | Weekly study hours (primary) + current streak (secondary badge) |
| Joining | Join by invite code → **pending request**; group **owner approves** |
| Roles | Creator = `owner` (approve/remove/rename/delete); others = `member` |
| Privacy | **Per-group** visibility toggle each member controls |
| Aggregate exposure | **Live `SECURITY DEFINER` RPC** computing from `study_sessions` (user's choice over the snapshot approach) |
| Divergence mitigation | RPC returns **raw aggregate inputs**; the **client** runs `computeAchievements()` so achievement-unlock logic stays single-source in TS |
| Sharing model | Publish a **self-contained jsonb snapshot**; members **import** ("Add to my account") |
| v1 shareable types | `flashcard_deck`, `exam_set` (notes added when Notes ships) |
| Timezone | All date math in **Asia/Bangkok** (project rule — never `toISOString()` for date-only) |

## Architecture

All group logic lives in `SECURITY DEFINER` Postgres functions so raw `study_sessions` are never
readable cross-user — the RPCs return only aggregates. Membership/group/share tables use RLS, with
`SECURITY DEFINER` helper functions to avoid the classic self-referential `group_members` RLS
recursion.

Client talks to these via a thin `src/lib/groups.ts` module (`supabase.rpc(...)` wrappers + a
Svelte store). This is intentionally **not** the repo engine: leaderboard data is server-computed
and groups are auth-only, so the local/Supabase dual-mode `repo()` pattern doesn't apply. The
sharing layer uses a plain RLS table read/written directly (snapshots are built client-side).

## Data Model

### `study_groups`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid | `= auth.uid()` of creator |
| `name` | text | not null, trimmed, 1–60 chars |
| `invite_code` | text | unique, ~8-char base32 (unambiguous alphabet), generated server-side |
| `created_at` | timestamptz | default `now()` |

### `group_members`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `group_id` | uuid FK → `study_groups(id)` on delete cascade | |
| `user_id` | uuid | the member |
| `role` | text | check in (`owner`,`member`), default `member` |
| `status` | text | check in (`pending`,`approved`), default `pending` |
| `visible` | boolean | default `true` (per-group leaderboard visibility) |
| `created_at` | timestamptz | default `now()` (request time) |
| `approved_at` | timestamptz | null until approved |
| unique | `(group_id, user_id)` | one membership per user per group |

Indexes: `(group_id)`, `(user_id)`, and a partial index on `(group_id) where status='pending'`.

### `group_shares`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `group_id` | uuid FK → `study_groups(id)` on delete cascade | |
| `shared_by` | uuid | `= auth.uid()` of sharer |
| `kind` | text | check in (`flashcard_deck`,`exam_set`) |
| `title` | text | display label (e.g., deck/topic name) |
| `payload` | jsonb | self-contained snapshot (shapes below) |
| `created_at` | timestamptz | default `now()` |

Index: `(group_id, created_at desc)`.

## RLS & Helper Functions

`SECURITY DEFINER` helpers (own schema, `search_path` pinned):
- `is_group_member(gid uuid, uid uuid) returns boolean` — true if an **approved** membership exists.
- `is_group_owner(gid uuid, uid uuid) returns boolean` — true if `study_groups.owner_id = uid`.

Policies:
- **`study_groups`**: SELECT if `is_group_member(id, auth.uid())` OR `owner_id = auth.uid()`.
  INSERT/UPDATE/DELETE handled via RPCs (or owner-gated policies).
- **`group_members`**: SELECT own rows always; SELECT co-members' rows if `is_group_member(group_id, auth.uid())`. Mutations via RPCs only (avoid recursion + enforce owner gating in one place).
- **`group_shares`**: SELECT if `is_group_member(group_id, auth.uid())`. INSERT if caller is an approved member (`is_group_member`) and `shared_by = auth.uid()`. DELETE if `shared_by = auth.uid()` OR `is_group_owner(group_id, auth.uid())`.

## RPCs (`SECURITY DEFINER`, `search_path = public`)

All raise exceptions on violation (caller catches → `toast.error`). All enforce auth.

- `create_group(p_name text) returns study_groups` — inserts group (generates unique
  `invite_code`) + an `owner`/`approved`/`visible` membership for the caller. Enforces the
  per-user group cap.
- `join_group(p_invite_code text) returns group_members` — finds group by code; inserts a
  `pending`/`member` membership for the caller (idempotent if already a member/pending). Errors on
  bad code or member-cap reached.
- `approve_member(p_group_id uuid, p_user_id uuid)` — owner only; sets `status='approved'`,
  `approved_at=now()`.
- `remove_member(p_group_id uuid, p_user_id uuid)` — owner only (cannot remove self/owner; owner
  uses `delete_group`); deletes the membership.
- `rename_group(p_group_id uuid, p_name text)` — owner only.
- `delete_group(p_group_id uuid)` — owner only; cascade removes members + shares.
- `leave_group(p_group_id uuid)` — any member (owner cannot leave; must delete or transfer — v1:
  owner cannot leave, only delete).
- `set_visibility(p_group_id uuid, p_visible boolean)` — caller toggles own `visible`.
- `list_my_groups() returns table(...)` — groups the caller belongs to, with `role`, `status`,
  `member_count`, and `pending_count` (for the owner's approval badge).
- `list_pending_requests(p_group_id uuid) returns table(user_id, display_name, created_at)` —
  owner only.
- `get_group_leaderboard(p_group_id uuid) returns table(...)` — **core RPC**. Verifies caller is
  an approved member. For each approved member who is `visible` (plus the caller themselves even if
  hidden), returns one row of **raw aggregates** computed from that member's `study_sessions`
  (+ counts from `mock_scores`, `tasks`, `flashcards`):
  - `user_id`, `display_name` (from `auth.users.raw_user_meta_data->>'name'`, fallback "Student")
  - `weekly_hours` numeric — sum of `duration_sec`/3600 for sessions in the current
    **Asia/Bangkok** week (week starts Monday 00:00 Bangkok; confirm against app week convention
    during implementation)
  - `streak` int — consecutive day-streak ending today/yesterday, computed in SQL over distinct
    Bangkok session-dates (gaps-and-islands / date-walk CTE)
  - `total_hours` numeric, `session_count` int, `mock_count` int, `best_mock_accuracy` numeric,
    `cards_count` int, `tasks_completed` int
  - The **client** maps these into `AchievementInput` and calls `computeAchievements()` for badges
    — no achievement thresholds in SQL.

## Client

- **`src/lib/groups.ts`** — typed wrappers over each RPC + `group_shares` table ops, a `myGroups`
  writable store, and a `loadMyGroups()` populator. Errors surfaced via existing `toast`.
- **`/routes/(app)/groups/+page.svelte`** — list my groups (name, member count, role, pending
  badge for owners); "Create group" and "Join by code" actions. Guest mode → sign-in prompt
  (auth-only).
- **`/routes/(app)/groups/[id]/+page.svelte`** — three sections:
  1. **Leaderboard** — `get_group_leaderboard` rows ranked by `weekly_hours` desc, streak badge.
     (Weekly hours are computed live for the current Bangkok week server-side, so no client
     staleness handling is needed.) Member row tap → their unlocked achievements (client-computed).
  2. **Shared** tab — list `group_shares` (kind icon, title, sharer); "Share…" picker (choose one
     of your decks / exam sets → snapshot → insert); each card has "Add to my account" → import.
  3. **Manage** — owner: pending-approval list (approve/reject), rename, delete, remove members.
     Member: per-group visibility toggle, leave.
- **Nav** — entry in `Sidebar.svelte` and `MoreDrawer.svelte`, **Track** group.
- **i18n** — keys in `src/lib/i18n/en.ts` and `th.ts`.

## Sharing — snapshot payloads & import

Snapshots are self-contained (no FKs to the sharer's rows). IDs are regenerated on import via
`newId()`; imported rows get the importer's `user_id` through the normal repos.

- **`flashcard_deck`** payload: `{ topicName, subjectName?, cards: [{ front, back, ... }] }`.
  Import: create/find a subject + topic for the importer, then `flashcardsRepo` inserts the cards.
- **`exam_set`** payload: `{ title, questions: [{ prompt, choices, answer, ... }] }`.
  Import: `examQuestionsRepo` inserts the questions for the importer. Reuse parsing/shape helpers
  from `src/lib/import.ts` where applicable.

## Error Handling

- RPC exceptions → caught in `groups.ts` → `toast.error` (no try/catch in pages, matching the repo
  engine convention).
- Join flow surfaces explicit states: invalid code, already a member, pending ("Request sent —
  waiting for the owner to approve"), member-cap reached.

## Limits (enforced in RPCs)

- Max **50** approved members per group.
- Max **20** groups per user (owned or joined).
- `name` 1–60 chars; `invite_code` collision-retried on generation.

## Testing

- **vitest** — client helpers: current-Bangkok-week boundary math; mapping a leaderboard row →
  `AchievementInput` → `computeAchievements()`; snapshot build/import round-trip shape.
- **SQL** — verify `get_group_leaderboard` streak/weekly-hours against seeded sample data via
  read-only `execute_sql`; confirm RLS denies cross-group reads (a non-member gets nothing).
- **Browser** — create→join→approve→leaderboard→share→import end-to-end, mobile 390px + desktop,
  EN + TH, in a non-Apple and the Apple theme.
- **Advisors** — run Supabase `get_advisors` to confirm RLS enabled on all three tables.

## Implementation Phasing (one spec, ordered tasks)

1. **Groups core** — migration (3 tables, helpers, RLS), membership RPCs, `groups.ts`, `/groups`
   list + create/join, owner approve/manage. *Migration + RPCs are production actions — get
   explicit go-ahead before applying to prod.*
2. **Leaderboard** — `get_group_leaderboard` RPC (Bangkok weekly + streak), `/groups/[id]`
   leaderboard section, client achievement mapping.
3. **Sharing** — `group_shares` table/RLS, Shared tab, share picker + import for `flashcard_deck`
   and `exam_set`.

Each phase is independently shippable.

## Roadmap (future specs, not this one)

1. **Notes** — standalone dual-mode note entity (`/notes`), guest-capable; then add `note` to the
   sharing `kind` enum + import path. *(Next spec.)*
2. **Live study presence** — YPT-style "studying now" + live timers via Supabase Realtime.
3. **Marketplace** — public/paid content packs built on the sharing layer; pairs with a lean
   "Pulse Pro" subscription.

## Open Questions (resolve during implementation)

- Week-start convention: confirm Monday vs Sunday against the existing `/schedule` week logic so
  the leaderboard "week" matches the rest of the app.
- Streak definition parity: ensure the SQL streak matches `streak` in `data.ts` exactly
  (counts today or yesterday as the anchor).
