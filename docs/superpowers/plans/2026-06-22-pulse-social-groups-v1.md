# Pulse Social — Study Groups v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship auth-only study groups with an invite/approve flow, a weekly-hours + streak leaderboard, and snapshot-based sharing of flashcard decks and exam sets.

**Architecture:** Three RLS-protected tables (`study_groups`, `group_members`, `group_shares`). All group mutations and the leaderboard read go through `SECURITY DEFINER` Postgres functions so raw `study_sessions` are never exposed cross-user; the leaderboard RPC returns *raw aggregate inputs* and the client computes achievement badges via the existing `computeAchievements()`. A thin `src/lib/groups.ts` module wraps the RPCs (not the repo engine — this is server-computed, auth-only data).

**Tech Stack:** SvelteKit 2 + TypeScript (Svelte 4 idiom), Supabase JS v2 + Postgres RLS/RPC, plain CSS tokens, vitest.

**Spec:** `docs/superpowers/specs/2026-06-22-pulse-social-groups-v1-design.md`

## Global Constraints

- **Auth-only.** Guest mode shows a sign-in prompt; never call group RPCs as a guest.
- **Dual-mode rule does NOT apply here** — groups are Supabase-only; do not add localStorage paths.
- **Timezone: Asia/Bangkok** for all date math. Never `toISOString()` for date-only values; use the SQL `at time zone 'Asia/Bangkok'` pattern server-side and `localDateStr` client-side.
- **RLS on every table**, policy basis `auth.uid()`. Use the `is_group_member` / `is_group_owner` `SECURITY DEFINER` helpers inside policies to avoid `group_members` self-referential recursion.
- **No hardcoded hex** — CSS tokens only. **No `transition: width/height`** — use transform.
- **i18n in BOTH** `src/lib/i18n/en.ts` and `src/lib/i18n/th.ts`.
- **Production actions need explicit user go-ahead**: applying any migration or RPC to the prod Supabase project. Develop/verify against a Supabase **dev branch** (`mcp__supabase__create_branch`) first; only `apply_migration` to prod after the user OKs.
- **`npm run check` = 0 errors** before every commit. **Codex writes; Claude verifies** (`npm run check`, vitest, browser, diff review).
- Caps: **50** approved members/group, **20** groups/user, group `name` 1–60 chars.
- Achievement logic stays single-source in `src/lib/achievements.ts` — **no** achievement thresholds in SQL.

---

## File Structure

**Migrations (applied via Supabase MCP, not committed as runnable SQL but recorded in the repo for reference):**
- `supabase/migrations/<ts>_groups_core.sql` — tables, indexes, helpers, RLS, membership RPCs.
- `supabase/migrations/<ts>_groups_leaderboard.sql` — `get_group_leaderboard` RPC.
- `supabase/migrations/<ts>_group_shares.sql` — `group_shares` table + RLS.

**Client:**
- Create `src/lib/groups.ts` — RPC wrappers, `GroupSummary`/`LeaderboardRow`/`PendingRequest`/`GroupShare` types, `myGroups` store, `loadMyGroups()`, share build/import helpers.
- Create `src/routes/(app)/groups/+page.svelte` — group list + create + join.
- Create `src/routes/(app)/groups/[id]/+page.svelte` — leaderboard + shared + manage.
- Create `src/lib/components/groups/` — `GroupCard.svelte`, `LeaderboardRow.svelte`, `ShareItemCard.svelte`, `SharePickerSheet.svelte` (feature components).
- Modify `src/lib/components/Sidebar.svelte` and `src/lib/components/MoreDrawer.svelte` — Track nav entry.
- Modify `src/lib/i18n/en.ts` and `src/lib/i18n/th.ts` — `groups.*` keys.
- Create `src/lib/groups.test.ts` — vitest for week/streak parity helpers + share round-trip shapes.

---

## Phase 1 — Groups core

### Task 1: Groups-core migration (tables, helpers, RLS)

**Files:**
- Create (record): `supabase/migrations/<ts>_groups_core.sql`
- Apply via: `mcp__supabase__create_branch` → `mcp__supabase__apply_migration` (dev branch)

**Interfaces:**
- Produces tables `study_groups`, `group_members`; functions `is_group_member(uuid,uuid)`, `is_group_owner(uuid,uuid)`, `gen_invite_code()`.

- [ ] **Step 1: Create a Supabase dev branch** (so nothing touches prod)

Use `mcp__supabase__create_branch` with a name like `groups-v1`. Record the branch project ref for subsequent calls.

- [ ] **Step 2: Apply the tables + helpers + RLS migration**

Apply this SQL via `mcp__supabase__apply_migration` (name `groups_core`):

```sql
create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  status text not null default 'pending' check (status in ('pending','approved')),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (group_id, user_id)
);
create index group_members_group_idx on public.group_members(group_id);
create index group_members_user_idx on public.group_members(user_id);
create index group_members_pending_idx on public.group_members(group_id) where status = 'pending';

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and status = 'approved'
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.study_groups where id = p_group_id and owner_id = p_user_id);
$$;

create or replace function public.gen_invite_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.study_groups where invite_code = code);
  end loop;
  return code;
end;
$$;

alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;

create policy study_groups_select on public.study_groups for select
  using (owner_id = auth.uid() or public.is_group_member(id, auth.uid()));

create policy group_members_select_self on public.group_members for select
  using (user_id = auth.uid());
create policy group_members_select_comember on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));
```

(No INSERT/UPDATE/DELETE policies — all writes go through `SECURITY DEFINER` RPCs in Task 2. RLS-enabled tables reject direct client writes, which is intended.)

- [ ] **Step 3: Verify via execute_sql**

Run `mcp__supabase__execute_sql` on the branch:
```sql
select tablename, rowsecurity from pg_tables where tablename in ('study_groups','group_members');
select proname from pg_proc where proname in ('is_group_member','is_group_owner','gen_invite_code');
```
Expected: both tables `rowsecurity = true`; all three functions listed.

- [ ] **Step 4: Run get_advisors**

Run `mcp__supabase__get_advisors` (type `security`). Expected: no new errors about RLS-disabled tables.

### Task 2: Membership RPCs

**Files:**
- Apply via `mcp__supabase__apply_migration` (name `groups_membership_rpcs`).

**Interfaces:**
- Produces RPCs: `create_group(text) -> study_groups`, `join_group(text) -> group_members`, `approve_member(uuid,uuid)`, `remove_member(uuid,uuid)`, `rename_group(uuid,text)`, `delete_group(uuid)`, `leave_group(uuid)`, `set_visibility(uuid,boolean)`, `list_my_groups()`, `list_pending_requests(uuid)`.

- [ ] **Step 1: Apply the RPC migration**

```sql
-- CREATE GROUP (caller becomes approved owner)
create or replace function public.create_group(p_name text)
returns public.study_groups language plpgsql security definer set search_path = public as $$
declare g public.study_groups; n int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'invalid name'; end if;
  select count(*) into n from public.group_members where user_id = auth.uid();
  if n >= 20 then raise exception 'group limit reached'; end if;
  insert into public.study_groups(owner_id, name, invite_code)
    values (auth.uid(), trim(p_name), public.gen_invite_code()) returning * into g;
  insert into public.group_members(group_id, user_id, role, status, approved_at)
    values (g.id, auth.uid(), 'owner', 'approved', now());
  return g;
end; $$;

-- JOIN BY CODE (pending)
create or replace function public.join_group(p_invite_code text)
returns public.group_members language plpgsql security definer set search_path = public as $$
declare g public.study_groups; m public.group_members; approved_n int; my_n int;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into g from public.study_groups where invite_code = upper(trim(p_invite_code));
  if g.id is null then raise exception 'invalid code'; end if;
  select count(*) into my_n from public.group_members where user_id = auth.uid();
  if my_n >= 20 then raise exception 'group limit reached'; end if;
  select count(*) into approved_n from public.group_members where group_id = g.id and status='approved';
  if approved_n >= 50 then raise exception 'group full'; end if;
  insert into public.group_members(group_id, user_id, role, status)
    values (g.id, auth.uid(), 'member', 'pending')
    on conflict (group_id, user_id) do nothing
    returning * into m;
  if m.id is null then select * into m from public.group_members where group_id=g.id and user_id=auth.uid(); end if;
  return m;
end; $$;

-- APPROVE (owner only)
create or replace function public.approve_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  update public.group_members set status='approved', approved_at=now()
    where group_id=p_group_id and user_id=p_user_id and status='pending';
end; $$;

-- REMOVE MEMBER (owner only; not the owner themselves)
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  if public.is_group_owner(p_group_id, p_user_id) then raise exception 'cannot remove owner'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=p_user_id;
end; $$;

-- RENAME (owner only)
create or replace function public.rename_group(p_group_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'invalid name'; end if;
  update public.study_groups set name=trim(p_name) where id=p_group_id;
end; $$;

-- DELETE (owner only; cascades members + shares)
create or replace function public.delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  delete from public.study_groups where id=p_group_id;
end; $$;

-- LEAVE (members only; owner must delete)
create or replace function public.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_group_owner(p_group_id, auth.uid()) then raise exception 'owner cannot leave; delete instead'; end if;
  delete from public.group_members where group_id=p_group_id and user_id=auth.uid();
end; $$;

-- SET VISIBILITY (self)
create or replace function public.set_visibility(p_group_id uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.group_members set visible=p_visible where group_id=p_group_id and user_id=auth.uid();
end; $$;

-- LIST MY GROUPS (with counts)
create or replace function public.list_my_groups()
returns table(id uuid, name text, invite_code text, role text, status text, visible boolean,
              member_count bigint, pending_count bigint, is_owner boolean)
language sql security definer set search_path = public as $$
  select g.id, g.name,
         case when g.owner_id = auth.uid() then g.invite_code else null end as invite_code,
         me.role, me.status, me.visible,
         (select count(*) from public.group_members x where x.group_id=g.id and x.status='approved') as member_count,
         (select count(*) from public.group_members x where x.group_id=g.id and x.status='pending') as pending_count,
         (g.owner_id = auth.uid()) as is_owner
  from public.group_members me
  join public.study_groups g on g.id = me.group_id
  where me.user_id = auth.uid()
  order by g.created_at desc;
$$;

-- LIST PENDING (owner only)
create or replace function public.list_pending_requests(p_group_id uuid)
returns table(user_id uuid, display_name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(p_group_id, auth.uid()) then raise exception 'not owner'; end if;
  return query
    select m.user_id,
           coalesce(u.raw_user_meta_data->>'name', 'Student') as display_name,
           m.created_at
    from public.group_members m
    join auth.users u on u.id = m.user_id
    where m.group_id = p_group_id and m.status = 'pending'
    order by m.created_at asc;
end; $$;
```

- [ ] **Step 2: Smoke-test the RPCs via execute_sql**

On the dev branch, impersonate is not trivial via SQL, so verify function existence + a direct call path:
```sql
select proname, prosecdef from pg_proc where proname in
 ('create_group','join_group','approve_member','remove_member','rename_group',
  'delete_group','leave_group','set_visibility','list_my_groups','list_pending_requests');
```
Expected: all 10 listed with `prosecdef = true` (security definer). Full behavior is verified in browser at Task 5.

### Task 3: `groups.ts` module + types

**Files:**
- Create: `src/lib/groups.ts`
- Reference patterns: `src/lib/supabase.ts` (client), `src/lib/stores/data.ts` (store style), `src/lib/toast.ts` (errors).

**Interfaces:**
- Produces: `myGroups` writable store; `loadMyGroups(): Promise<void>`; `createGroup(name)`, `joinGroup(code)`, `approveMember(gid,uid)`, `removeMember(gid,uid)`, `renameGroup(gid,name)`, `deleteGroup(gid)`, `leaveGroup(gid)`, `setVisibility(gid,visible)`, `listPending(gid)`; types `GroupSummary`, `PendingRequest`.

- [ ] **Step 1: Write the module**

```ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { toast } from '$lib/stores/toast';

export interface GroupSummary {
  id: string; name: string; inviteCode: string | null;
  role: 'owner' | 'member'; status: 'pending' | 'approved'; visible: boolean;
  memberCount: number; pendingCount: number; isOwner: boolean;
}
export interface PendingRequest { userId: string; displayName: string; createdAt: string; }

export const myGroups = writable<GroupSummary[]>([]);

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) { toast.error(error.message); return null; }
  return data as T;
}

export async function loadMyGroups(): Promise<void> {
  const { data, error } = await supabase.rpc('list_my_groups');
  if (error) { toast.error(error.message); return; }
  myGroups.set((data ?? []).map((r: any): GroupSummary => ({
    id: r.id, name: r.name, inviteCode: r.invite_code,
    role: r.role, status: r.status, visible: r.visible,
    memberCount: Number(r.member_count), pendingCount: Number(r.pending_count), isOwner: r.is_owner,
  })));
}

export async function createGroup(name: string) { const r = await rpc('create_group', { p_name: name }); await loadMyGroups(); return r; }
export async function joinGroup(code: string)   { const r = await rpc('join_group', { p_invite_code: code }); await loadMyGroups(); return r; }
export async function approveMember(gid: string, uid: string) { await rpc('approve_member', { p_group_id: gid, p_user_id: uid }); await loadMyGroups(); }
export async function removeMember(gid: string, uid: string)  { await rpc('remove_member', { p_group_id: gid, p_user_id: uid }); }
export async function renameGroup(gid: string, name: string)  { await rpc('rename_group', { p_group_id: gid, p_name: name }); await loadMyGroups(); }
export async function deleteGroup(gid: string) { await rpc('delete_group', { p_group_id: gid }); await loadMyGroups(); }
export async function leaveGroup(gid: string)  { await rpc('leave_group', { p_group_id: gid }); await loadMyGroups(); }
export async function setVisibility(gid: string, visible: boolean) { await rpc('set_visibility', { p_group_id: gid, p_visible: visible }); await loadMyGroups(); }

export async function listPending(gid: string): Promise<PendingRequest[]> {
  const { data, error } = await supabase.rpc('list_pending_requests', { p_group_id: gid });
  if (error) { toast.error(error.message); return []; }
  return (data ?? []).map((r: any): PendingRequest => ({ userId: r.user_id, displayName: r.display_name, createdAt: r.created_at }));
}
```

(Confirm `src/lib/toast.ts` export name during implementation; if it's `toast.error` vs a named export, match the existing import used in repo `entities.ts`.)

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/groups.ts
git commit -m "feat(groups): supabase RPC client module + groups store"
```

### Task 4: `/groups` list + create + join page

**Files:**
- Create: `src/routes/(app)/groups/+page.svelte`
- Create: `src/lib/components/groups/GroupCard.svelte`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/th.ts` (add `groups` section)
- Reference: New Page recipe in CLAUDE.md; `src/lib/stores/auth.ts` for guest gating.

**Interfaces:**
- Consumes: `myGroups`, `loadMyGroups`, `createGroup`, `joinGroup` from `groups.ts`.

- [ ] **Step 1: Add i18n keys** (both `en.ts` and `th.ts`, mirror existing structure)

```ts
// en.ts — add to the root object
groups: {
  title: 'Study groups',
  signInPrompt: 'Sign in to join study groups.',
  create: 'Create group', join: 'Join by code',
  namePlaceholder: 'Group name', codePlaceholder: 'Invite code',
  members: (n: number) => `${n} member${n === 1 ? '' : 's'}`,
  pending: (n: number) => `${n} pending`,
  pendingState: 'Request sent — waiting for approval',
  empty: 'No groups yet.', emptySub: 'Create one or join with a code.',
  leaderboard: 'Leaderboard', shared: 'Shared', manage: 'Manage',
  weeklyHours: 'This week', streak: 'Streak', leave: 'Leave group',
  delete: 'Delete group', rename: 'Rename', approve: 'Approve', remove: 'Remove',
  visibleOn: 'Visible on leaderboard', visibleOff: 'Hidden from leaderboard',
  share: 'Share…', addToAccount: 'Add to my account', inviteCode: 'Invite code',
  shareDeck: 'Flashcard deck', shareExam: 'Exam set', imported: 'Added to your account',
},
```
(Translate to Thai in `th.ts` with the same keys/shapes.)

- [ ] **Step 2: Write GroupCard.svelte**

```svelte
<script lang="ts">
  import type { GroupSummary } from '$lib/groups';
  import { t } from '$lib/i18n';
  export let group: GroupSummary;
</script>

<a class="card group-card" href="/groups/{group.id}">
  <div class="g-name">{group.name}</div>
  <div class="g-meta">
    <span>{$t.groups.members(group.memberCount)}</span>
    {#if group.status === 'pending'}<span class="pend">{$t.groups.pendingState}</span>{/if}
    {#if group.isOwner && group.pendingCount > 0}<span class="badge">{$t.groups.pending(group.pendingCount)}</span>{/if}
  </div>
</a>

<style>
  .group-card { display: block; padding: 14px 16px; text-decoration: none; color: var(--text); }
  .g-name { font-size: 15px; font-weight: 600; }
  .g-meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; font-size: 12px; color: var(--muted); }
  .badge { background: var(--primary); color: var(--bg); border-radius: 9999px; padding: 1px 8px; font-weight: 600; }
  .pend { color: var(--warning); }
</style>
```

- [ ] **Step 3: Write the page** (guest-gated; follows New Page recipe)

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { myGroups, loadMyGroups, createGroup, joinGroup } from '$lib/groups';
  import GroupCard from '$lib/components/groups/GroupCard.svelte';
  import { t } from '$lib/i18n';

  let name = ''; let code = '';
  onMount(() => { if ($auth.mode === 'authenticated') loadMyGroups(); });
  $: if ($auth.mode === 'authenticated') loadMyGroups();

  async function onCreate() { if (name.trim()) { await createGroup(name.trim()); name=''; } }
  async function onJoin() { if (code.trim()) { await joinGroup(code.trim()); code=''; } }
</script>

<div class="page">
  <h1 class="text-large-title">{$t.groups.title}</h1>
  {#if $auth.mode !== 'authenticated'}
    <div class="empty-state"><p class="empty-title">{$t.groups.signInPrompt}</p></div>
  {:else}
    <div class="actions">
      <input class="g-input" bind:value={name} placeholder={$t.groups.namePlaceholder} />
      <button class="btn btn-primary" on:click={onCreate}>{$t.groups.create}</button>
    </div>
    <div class="actions">
      <input class="g-input" bind:value={code} placeholder={$t.groups.codePlaceholder} />
      <button class="btn btn-secondary" on:click={onJoin}>{$t.groups.join}</button>
    </div>
    {#if $myGroups.length === 0}
      <div class="empty-state"><p class="empty-title">{$t.groups.empty}</p><p class="empty-sub">{$t.groups.emptySub}</p></div>
    {:else}
      <div class="g-list">{#each $myGroups as g (g.id)}<GroupCard group={g} />{/each}</div>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 20px 16px 80px; max-width: 600px; margin: 0 auto; }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
  .g-input { flex: 1; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--radius-md); background: var(--bg2); color: var(--text); font-family: inherit; font-size: 15px; outline: none; }
  .g-list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
  .empty-state { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 32px 16px; text-align: center; margin-top: 16px; }
  .empty-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--muted); }
</style>
```

- [ ] **Step 4: Type-check, then commit**

Run: `npm run check` (expected 0 errors).
```bash
git add src/routes/\(app\)/groups/+page.svelte src/lib/components/groups/GroupCard.svelte src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat(groups): /groups list, create, join page + i18n"
```

### Task 5: Nav entry + end-to-end browser verify (Phase 1)

**Files:**
- Modify: `src/lib/components/Sidebar.svelte` (Track group array), `src/lib/components/MoreDrawer.svelte`.

- [ ] **Step 1: Add nav entry** to the Track group in both files: `{ label: 'Study groups', href: '/groups', d: '<people SVG path d>' }` (reuse an existing people/group icon `d` from the codebase; find one via grep of existing SVG paths).

- [ ] **Step 2: Point the local Supabase client at the dev branch**

Temporarily set `.env.local` `PUBLIC_SUPABASE_URL`/`ANON_KEY` to the dev branch (from `create_branch` output) so browser testing hits the branch, not prod. Restart `npm run dev`.

- [ ] **Step 3: Browser-verify the flow** (chrome-devtools MCP, two accounts or two browser profiles)

Account A: create a group → appears in list with invite code. Account B: join by code → sees "request sent". Account A: opens group → sees pending badge. (Approval UI lands in Task 7's manage section; for now verify `list_pending_requests` returns B via execute_sql.)

- [ ] **Step 4: Commit nav**

```bash
git add src/lib/components/Sidebar.svelte src/lib/components/MoreDrawer.svelte
git commit -m "feat(groups): add Study groups to Track nav"
```

---

## Phase 2 — Leaderboard

### Task 6: `get_group_leaderboard` RPC

**Files:**
- Apply via `mcp__supabase__apply_migration` (name `groups_leaderboard`) on the dev branch.

**Interfaces:**
- Produces RPC `get_group_leaderboard(p_group_id uuid)` returning per-member raw aggregates.

- [ ] **Step 1: Apply the leaderboard RPC**

```sql
create or replace function public.get_group_leaderboard(p_group_id uuid)
returns table(
  user_id uuid, display_name text,
  weekly_hours numeric, streak int, total_hours numeric,
  session_count int, mock_count int, best_mock_accuracy numeric,
  cards_count int, tasks_completed int
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(p_group_id, auth.uid()) then raise exception 'not a member'; end if;
  return query
  select m.user_id,
         coalesce(u.raw_user_meta_data->>'name','Student') as display_name,
         coalesce(agg.weekly_hours,0)::numeric as weekly_hours,
         coalesce(public.user_streak(m.user_id),0) as streak,
         coalesce(agg.total_hours,0)::numeric as total_hours,
         coalesce(agg.session_count,0) as session_count,
         coalesce(mk.mock_count,0) as mock_count,
         coalesce(mk.best_accuracy,0)::numeric as best_mock_accuracy,
         coalesce(cd.cards_count,0) as cards_count,
         coalesce(tk.tasks_completed,0) as tasks_completed
  from public.group_members m
  join auth.users u on u.id = m.user_id
  left join lateral (
    select sum(s.duration_sec)/3600.0 as total_hours,
           sum(s.duration_sec) filter (
             where (s.started_at at time zone 'Asia/Bangkok')::date
                   >= date_trunc('week', (now() at time zone 'Asia/Bangkok'))::date
           )/3600.0 as weekly_hours,
           count(*)::int as session_count
    from public.study_sessions s where s.user_id = m.user_id
  ) agg on true
  left join lateral (
    -- Parity with AchievementWall.svelte: mockCount + bestMockAccuracy come from
    -- exam_sessions (in-app practice), NOT mock_scores.
    select count(*)::int as mock_count,
           max(100.0 * total_correct / nullif(total_questions,0)) as best_accuracy
    from public.exam_sessions es where es.user_id = m.user_id
  ) mk on true
  left join lateral (
    select count(*)::int as cards_count from public.flashcards f where f.user_id = m.user_id
  ) cd on true
  left join lateral (
    select count(*)::int as tasks_completed from public.tasks t
    where t.user_id = m.user_id and t.completed_at is not null
  ) tk on true
  where m.group_id = p_group_id and m.status='approved'
    and (m.visible = true or m.user_id = auth.uid())
  order by weekly_hours desc, streak desc;
end; $$;
```

Plus the streak helper (matches `data.ts`: island ending today or yesterday, Bangkok):

```sql
create or replace function public.user_streak(p_user_id uuid)
returns int language sql security definer stable set search_path = public as $$
  with days as (
    select distinct (started_at at time zone 'Asia/Bangkok')::date as d
    from public.study_sessions where user_id = p_user_id
  ),
  ranked as ( select d, (d - (row_number() over (order by d))::int) as grp from days ),
  islands as ( select max(d) as last_day, count(*)::int as len from ranked group by grp )
  select coalesce((
    select len from islands
    where last_day >= (now() at time zone 'Asia/Bangkok')::date - 1
    order by last_day desc limit 1
  ), 0);
$$;
```

> **Schema confirmed (2026-06-22) against prod:** `study_sessions(duration_sec int, started_at timestamptz, user_id)`, `tasks.completed_at`, `flashcards(front,back,topic_id,user_id)`, `exam_sessions(total_correct, total_questions, user_id)`. There is **no** `mock_scores.accuracy` — achievements use `exam_sessions` per `AchievementWall.svelte`. Confirm Postgres `date_trunc('week')` (Monday start) matches the app's `/schedule` week convention; if the app uses Sunday, adjust to `date_trunc('week', x + interval '1 day') - interval '1 day'`.

- [ ] **Step 2: Verify with seeded data via execute_sql**

Insert sample sessions for a test user across consecutive Bangkok days, then `select * from get_group_leaderboard('<group-id>')` won't run without an auth context; instead unit-verify the helpers directly:
```sql
select public.user_streak('<test-user-uuid>');
```
Expected: matches a hand-computed streak from the seeded dates.

### Task 7: `/groups/[id]` leaderboard + manage section

**Files:**
- Create: `src/routes/(app)/groups/[id]/+page.svelte`
- Create: `src/lib/components/groups/LeaderboardRow.svelte`
- Modify: `src/lib/groups.ts` (add `getLeaderboard`, `LeaderboardRow` type + `toAchievementInput` mapper)
- Reference: `src/lib/achievements.ts` (`computeAchievements`, `AchievementInput`).

**Interfaces:**
- Consumes: `getLeaderboard(gid)`, `myGroups`, `listPending`, `approveMember`, `removeMember`, `renameGroup`, `deleteGroup`, `leaveGroup`, `setVisibility`.
- Produces: `LeaderboardEntry` type `{ userId; displayName; weeklyHours; streak; achievements: Achievement[] }`.

- [ ] **Step 1: Extend groups.ts**

```ts
import { computeAchievements, type Achievement, type AchievementInput } from '$lib/achievements';

export interface LeaderboardEntry {
  userId: string; displayName: string; weeklyHours: number; streak: number;
  totalHours: number; achievements: Achievement[];
}

export async function getLeaderboard(gid: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_group_leaderboard', { p_group_id: gid });
  if (error) { toast.error(error.message); return []; }
  return (data ?? []).map((r: any): LeaderboardEntry => {
    const input: AchievementInput = {
      sessionCount: Number(r.session_count), totalHours: Number(r.total_hours),
      streak: Number(r.streak), mockCount: Number(r.mock_count),
      bestMockAccuracy: Number(r.best_mock_accuracy), cardCount: Number(r.cards_count),
      tasksCompleted: Number(r.tasks_completed),
    };
    return {
      userId: r.user_id, displayName: r.display_name,
      weeklyHours: Number(r.weekly_hours), streak: Number(r.streak),
      totalHours: Number(r.total_hours),
      achievements: computeAchievements(input).filter(a => a.unlocked),
    };
  });
}
```

- [ ] **Step 2: Write LeaderboardRow.svelte** (rank, name, weekly hours, streak badge, unlocked achievement icons)

```svelte
<script lang="ts">
  import type { LeaderboardEntry } from '$lib/groups';
  export let entry: LeaderboardEntry; export let rank: number;
</script>
<div class="row">
  <span class="rank">{rank}</span>
  <span class="name">{entry.displayName}</span>
  <span class="ach">{#each entry.achievements.slice(0,3) as a}{a.icon}{/each}</span>
  {#if entry.streak > 0}<span class="streak">🔥{entry.streak}</span>{/if}
  <span class="hrs">{entry.weeklyHours.toFixed(1)}h</span>
</div>
<style>
  .row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
  .rank { width: 20px; font-weight: 700; color: var(--muted); }
  .name { flex: 1; font-size: 14px; font-weight: 500; color: var(--text); }
  .ach { font-size: 13px; letter-spacing: 1px; }
  .streak { font-size: 12px; color: var(--muted); }
  .hrs { font-size: 14px; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 3: Write the [id] page** — three sections (leaderboard / shared placeholder / manage). Load the group from `myGroups` by `$page.params.id`; load leaderboard + pending on mount. Owner sees pending approve/remove + rename + delete; member sees visibility toggle + leave. (Shared tab is wired in Phase 3.)

Key script wiring:
```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { myGroups, loadMyGroups, getLeaderboard, listPending, approveMember,
           removeMember, renameGroup, deleteGroup, leaveGroup, setVisibility,
           type LeaderboardEntry, type PendingRequest } from '$lib/groups';
  import LeaderboardRow from '$lib/components/groups/LeaderboardRow.svelte';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';

  $: gid = $page.params.id;
  $: group = $myGroups.find(g => g.id === gid);
  let board: LeaderboardEntry[] = []; let pending: PendingRequest[] = [];
  let tab: 'leaderboard'|'shared'|'manage' = 'leaderboard';

  async function refresh() {
    board = await getLeaderboard(gid);
    if (group?.isOwner) pending = await listPending(gid);
  }
  onMount(async () => { if ($myGroups.length === 0) await loadMyGroups(); await refresh(); });
</script>
```
(Render tabs, leaderboard rows, manage controls; call `refresh()`/`loadMyGroups()` after mutations. After `deleteGroup`/`leaveGroup`, `goto('/groups')`.)

- [ ] **Step 4: Type-check + browser verify** (`npm run check` 0 errors; verify approve → member appears on leaderboard with correct weekly hours/streak; toggle visibility hides self for other members; owner delete returns to /groups).

- [ ] **Step 5: Commit**

```bash
git add src/routes/\(app\)/groups src/lib/components/groups/LeaderboardRow.svelte src/lib/groups.ts
git commit -m "feat(groups): leaderboard + manage on /groups/[id]"
```

---

## Phase 3 — Sharing

### Task 8: `group_shares` table + RLS

**Files:**
- Apply via `mcp__supabase__apply_migration` (name `group_shares`) on the dev branch.

- [ ] **Step 1: Apply the migration**

```sql
create table public.group_shares (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('flashcard_deck','exam_set')),
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index group_shares_group_idx on public.group_shares(group_id, created_at desc);

alter table public.group_shares enable row level security;

create policy group_shares_select on public.group_shares for select
  using (public.is_group_member(group_id, auth.uid()));
create policy group_shares_insert on public.group_shares for insert
  with check (shared_by = auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy group_shares_delete on public.group_shares for delete
  using (shared_by = auth.uid() or public.is_group_owner(group_id, auth.uid()));
```

- [ ] **Step 2: Verify** via `execute_sql`: table has `rowsecurity=true` and 3 policies; run `get_advisors` (security) → no new RLS errors.

### Task 9: Share build/list/import helpers in groups.ts

**Files:**
- Modify: `src/lib/groups.ts`
- Reference: `src/lib/data/entities.ts` (`flashcardsRepo`, `examQuestionsRepo`, `topicsRepo`, `subjectsRepo`), `src/lib/id.ts` (`newId`), `src/lib/types.ts` (`Flashcard`, `ExamQuestion`, `Topic`).

**Interfaces:**
- Produces: `GroupShare` type; `listShares(gid)`, `shareDeck(gid, topicId)`, `shareExamSet(gid, questionIds, title)`, `deleteShare(id)`, `importShare(share)`.

- [ ] **Step 1: Add types + list/delete**

```ts
export interface GroupShare {
  id: string; groupId: string; sharedBy: string;
  kind: 'flashcard_deck' | 'exam_set'; title: string; payload: any; createdAt: string;
}
export async function listShares(gid: string): Promise<GroupShare[]> {
  const { data, error } = await supabase.from('group_shares')
    .select('*').eq('group_id', gid).order('created_at', { ascending: false });
  if (error) { toast.error(error.message); return []; }
  return (data ?? []).map((r: any): GroupShare => ({
    id: r.id, groupId: r.group_id, sharedBy: r.shared_by,
    kind: r.kind, title: r.title, payload: r.payload, createdAt: r.created_at,
  }));
}
export async function deleteShare(id: string) {
  const { error } = await supabase.from('group_shares').delete().eq('id', id);
  if (error) toast.error(error.message);
}
```

- [ ] **Step 2: Add share builders** (snapshot from the user's own data via stores)

```ts
import { get } from 'svelte/store';
import { topics, flashcards, examQuestions, subjects } from '$lib/stores/data';

export async function shareDeck(gid: string, topicId: string) {
  const topic = get(topics).find(t => t.id === topicId);
  if (!topic) return;
  const subject = get(subjects).find(s => s.id === topic.subjectId);
  const cards = get(flashcards).filter(c => c.topicId === topicId)
    .map(c => ({ front: c.front, back: c.back }));
  const payload = { topicName: topic.name, subjectName: subject?.name ?? null, cards };
  const { error } = await supabase.from('group_shares')
    .insert({ group_id: gid, shared_by: (await supabase.auth.getUser()).data.user?.id, kind: 'flashcard_deck', title: topic.name, payload });
  if (error) toast.error(error.message);
}

export async function shareExamSet(gid: string, questionIds: string[], title: string) {
  // ExamQuestion fields (types.ts / mappers.ts): text, choices, correctIndex, subject, difficulty, year
  const qs = get(examQuestions).filter(q => questionIds.includes(q.id))
    .map(q => ({ text: q.text, choices: q.choices, correctIndex: q.correctIndex,
                 subject: q.subject, difficulty: q.difficulty, year: q.year }));
  const payload = { title, questions: qs };
  const { error } = await supabase.from('group_shares')
    .insert({ group_id: gid, shared_by: (await supabase.auth.getUser()).data.user?.id, kind: 'exam_set', title, payload });
  if (error) toast.error(error.message);
}
```
(Confirm `Flashcard`/`ExamQuestion` field names in `types.ts` and adjust the snapshot shape; the import in Step 3 must mirror exactly.)

- [ ] **Step 3: Add import** (clone snapshot into the importer's account via repos)

```ts
import { newId } from '$lib/id';
import { flashcardsRepo, examQuestionsRepo, topicsRepo, subjectsRepo } from '$lib/data/entities';
import { getAuthContext } from '$lib/stores/data';

export async function importShare(share: GroupShare) {
  const { userId } = getAuthContext();
  if (share.kind === 'flashcard_deck') {
    // ensure a subject + topic, then add cards
    let subjectId = get(subjects).find(s => s.name === share.payload.subjectName)?.id;
    if (!subjectId) { const s = await subjectsRepo.create?.(share.payload.subjectName ?? 'Imported'); subjectId = s?.id; }
    const topic = await topicsRepo.create(subjectId!, share.payload.topicName);
    for (const c of share.payload.cards) {
      await flashcardsRepo.save({ id: newId(), userId, topicId: topic.id, front: c.front, back: c.back } as any);
    }
  } else if (share.kind === 'exam_set') {
    for (const q of share.payload.questions) {
      await examQuestionsRepo.save({ id: newId(), userId, text: q.text, choices: q.choices,
        correctIndex: q.correctIndex, subject: q.subject, difficulty: q.difficulty, year: q.year } as any);
    }
  }
  toast.success?.($t_imported());
}
```
(Adjust to the *actual* `topicsRepo.create` / `subjectsRepo.create` signatures — read `entities.ts` first. Use the real required fields for `Flashcard`/`ExamQuestion` from `types.ts`. Replace `$t_imported()` with the real toast string.)

- [ ] **Step 4: Type-check + commit**

Run `npm run check` (0 errors).
```bash
git add src/lib/groups.ts
git commit -m "feat(groups): share build/list/import helpers"
```

### Task 10: Shared tab UI + share picker

**Files:**
- Create: `src/lib/components/groups/ShareItemCard.svelte`, `src/lib/components/groups/SharePickerSheet.svelte`
- Modify: `src/routes/(app)/groups/[id]/+page.svelte` (wire the Shared tab)
- Reference: `src/lib/components/BottomSheet.svelte` (portal pattern).

- [ ] **Step 1: ShareItemCard.svelte** — kind icon, title, sharer; "Add to my account" button → `importShare`; delete (if sharer/owner) → `deleteShare`.

- [ ] **Step 2: SharePickerSheet.svelte** — a `BottomSheet` (portaled) listing the user's topics-with-cards and exam sets; selecting one calls `shareDeck`/`shareExamSet` then closes + refreshes.

- [ ] **Step 3: Wire the Shared tab** in `[id]/+page.svelte`: on tab open, `shares = await listShares(gid)`; render `ShareItemCard`s; a "Share…" button opens `SharePickerSheet`.

- [ ] **Step 4: Browser-verify** the full share→import loop across two accounts (A shares a deck → B sees it → B "Add to my account" → deck appears in B's subjects). Mobile 390px + desktop, EN + TH.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/groups src/routes/\(app\)/groups
git commit -m "feat(groups): shared tab + share picker + import UI"
```

---

## Production Cutover (after all phases verified on the dev branch)

- [ ] Revert `.env.local` to prod Supabase.
- [ ] **Get explicit user go-ahead**, then apply the three migrations (`groups_core`, `groups_membership_rpcs` + `groups_leaderboard`, `group_shares`) to **prod** via `mcp__supabase__apply_migration`.
- [ ] Run `get_advisors` (security) on prod → confirm no RLS gaps.
- [ ] Merge the feature branch → `master` (PR, user-approved) → Vercel auto-deploys.
- [ ] Move this plan Open → Completed (CHANGELOG entry per CLAUDE.md).

## Verification Summary

- `npm run check` 0 errors before every commit; `npx vitest run` green.
- Cross-account browser test of create→join→approve→leaderboard→share→import.
- `get_advisors` clean on the dev branch and again on prod.
- Two open spec questions resolved during Task 6 (week-start convention, streak parity with `data.ts`).
