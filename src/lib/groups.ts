import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { toast } from '$lib/stores/toast';
import { computeAchievements, type Achievement, type AchievementInput } from '$lib/achievements';

export interface GroupSummary {
  id: string; name: string; inviteCode: string | null;
  role: 'owner' | 'member'; status: 'pending' | 'approved'; visible: boolean;
  memberCount: number; pendingCount: number; isOwner: boolean;
}
export interface PendingRequest { userId: string; displayName: string; createdAt: string; }
export interface LeaderboardEntry {
  userId: string; displayName: string; weeklyHours: number; streak: number;
  totalHours: number; achievements: Achievement[];
}

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
