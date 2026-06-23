import { get, writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { toast } from '$lib/stores/toast';
import { computeAchievements, type Achievement, type AchievementInput } from '$lib/achievements';
import { examQuestionsRepo, flashcardsRepo, subjectsRepo, topicsRepo } from '$lib/data/entities';
import { ALL_BUILTIN_PRESETS, SUBJECT_COLOR_PALETTE } from '$lib/constants';
import { newId } from '$lib/id';
import { t } from '$lib/i18n';
import { examQuestions, flashcards, getAuthContext, subjects, topics } from '$lib/stores/data';
import type { ExamQuestion, Flashcard, Subject, Topic } from '$lib/types';

export interface GroupSummary {
  id: string; name: string; inviteCode: string | null;
  description: string | null; icon: string | null;
  joinPolicy: 'approval' | 'open'; sharePolicy: 'members' | 'owner'; memberCap: number | null;
  role: 'owner' | 'member'; status: 'pending' | 'approved'; visible: boolean;
  memberCount: number; pendingCount: number; isOwner: boolean;
}
export interface PendingRequest { userId: string; displayName: string; createdAt: string; }
export interface LeaderboardEntry {
  userId: string; displayName: string; weeklyHours: number; streak: number;
  totalHours: number; achievements: Achievement[];
}
export interface GroupChallenge {
  id: string; groupId: string; createdBy: string; title: string; payload: ExamSetSnapshot; createdAt: string;
}
export interface ChallengeResult {
  userId: string; name: string; score: number; total: number; takenAt: string;
}

interface FlashcardDeckSnapshot {
  topicName: string;
  subjectName: string | null;
  cards: Pick<Flashcard, 'front' | 'back'>[];
}

interface ExamSetSnapshot {
  title: string;
  questions: Pick<ExamQuestion, 'text' | 'choices' | 'correctIndex' | 'subject' | 'difficulty' | 'year'>[];
}

export interface GroupShare {
  id: string;
  groupId: string;
  sharedBy: string;
  kind: 'flashcard_deck' | 'exam_set';
  title: string;
  payload: FlashcardDeckSnapshot | ExamSetSnapshot;
  createdAt: string;
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
    description: r.description ?? null, icon: r.icon ?? null,
    joinPolicy: r.join_policy, sharePolicy: r.share_policy,
    memberCap: r.member_cap == null ? null : Number(r.member_cap),
    role: r.role, status: r.status, visible: r.visible,
    memberCount: Number(r.member_count), pendingCount: Number(r.pending_count), isOwner: r.is_owner,
  })));
}

export async function createGroup(name: string) { const r = await rpc('create_group', { p_name: name }); await loadMyGroups(); return r; }
export async function joinGroup(code: string): Promise<'approved' | 'pending' | null> {
  const r = await rpc<{ status?: string }>('join_group', { p_invite_code: code });
  await loadMyGroups();
  return (r?.status === 'approved' || r?.status === 'pending') ? r.status : null;
}
export async function approveMember(gid: string, uid: string) { await rpc('approve_member', { p_group_id: gid, p_user_id: uid }); await loadMyGroups(); }
export async function removeMember(gid: string, uid: string)  { await rpc('remove_member', { p_group_id: gid, p_user_id: uid }); }
export async function renameGroup(gid: string, name: string)  { await rpc('rename_group', { p_group_id: gid, p_name: name }); await loadMyGroups(); }
export async function deleteGroup(gid: string) { await rpc('delete_group', { p_group_id: gid }); await loadMyGroups(); }
export async function leaveGroup(gid: string)  { await rpc('leave_group', { p_group_id: gid }); await loadMyGroups(); }
export async function setVisibility(gid: string, visible: boolean) { await rpc('set_visibility', { p_group_id: gid, p_visible: visible }); await loadMyGroups(); }
export async function updateGroupSettings(gid: string, fields: { name?: string; description?: string | null; icon?: string | null; joinPolicy?: 'approval' | 'open'; sharePolicy?: 'members' | 'owner'; memberCap?: number | null }) {
  await rpc('update_group_settings', {
    p_group_id: gid,
    p_name: fields.name ?? null,
    p_description: fields.description ?? null,
    p_icon: fields.icon ?? null,
    p_join_policy: fields.joinPolicy ?? null,
    p_share_policy: fields.sharePolicy ?? null,
    p_member_cap: fields.memberCap ?? null,
  });
  await loadMyGroups();
}

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

export async function listChallenges(gid: string): Promise<GroupChallenge[]> {
  const { data, error } = await supabase.from('group_challenges')
    .select('*')
    .eq('group_id', gid)
    .order('created_at', { ascending: false });
  if (error) { toast.error(error.message); return []; }
  return (data ?? []).map((row: any): GroupChallenge => ({
    id: row.id,
    groupId: row.group_id,
    createdBy: row.created_by,
    title: row.title,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}

export async function postChallenge(gid: string, questionIds: string[], title: string): Promise<string | null> {
  const { mode } = getAuthContext();
  if (mode !== 'authenticated') return null;
  const payload = buildExamSnapshot(questionIds, title);
  if (!payload) return null;
  return await rpc<string>('post_challenge', { p_group_id: gid, p_title: title, p_payload: payload });
}

export async function submitChallengeResult(
  challengeId: string,
  answers: number[],
): Promise<{ score: number; total: number } | null> {
  // Score is recomputed server-side from these answers vs the stored payload —
  // the client never sends (and cannot forge) a score. See submit_challenge_result RPC.
  const { data, error } = await supabase.rpc('submit_challenge_result', {
    p_challenge_id: challengeId,
    p_answers: answers,
  });
  if (error) { toast.error(error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { score: Number(row.score), total: Number(row.total) };
}

export async function getChallengeResults(challengeId: string): Promise<ChallengeResult[]> {
  const { data, error } = await supabase.rpc('get_challenge_results', { p_challenge_id: challengeId });
  if (error) { toast.error(error.message); return []; }
  return (data ?? []).map((r: any): ChallengeResult => ({
    userId: r.user_id,
    name: r.name,
    score: Number(r.score),
    total: Number(r.total),
    takenAt: r.taken_at,
  }));
}

export async function listShares(gid: string): Promise<GroupShare[]> {
  const { data, error } = await supabase.from('group_shares')
    .select('*')
    .eq('group_id', gid)
    .order('created_at', { ascending: false });
  if (error) { toast.error(error.message); return []; }
  return (data ?? []).map((row: any): GroupShare => ({
    id: row.id,
    groupId: row.group_id,
    sharedBy: row.shared_by,
    kind: row.kind,
    title: row.title,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}

export async function deleteShare(id: string): Promise<boolean> {
  const { error } = await supabase.from('group_shares').delete().eq('id', id);
  if (error) { toast.error(error.message); return false; }
  return true;
}

export async function shareDeck(gid: string, topicId: string): Promise<boolean> {
  const { userId, mode } = getAuthContext();
  if (mode !== 'authenticated') return false;
  const topic = get(topics).find(candidate => candidate.id === topicId);
  if (!topic) return false;
  const subject = get(subjects).find(candidate => candidate.id === topic.subjectId);
  const cards = get(flashcards)
    .filter(card => card.topicId === topicId)
    .map(card => ({ front: card.front, back: card.back }));
  if (cards.length === 0) return false;
  const payload: FlashcardDeckSnapshot = {
    topicName: topic.name,
    subjectName: subject?.name ?? null,
    cards,
  };
  const { error } = await supabase.from('group_shares').insert({
    group_id: gid,
    shared_by: userId,
    kind: 'flashcard_deck',
    title: topic.name,
    payload,
  });
  if (error) { toast.error(error.message); return false; }
  return true;
}

function buildExamSnapshot(questionIds: string[], title: string): ExamSetSnapshot | null {
  const selectedIds = new Set(questionIds);
  const questions = get(examQuestions)
    .filter(question => selectedIds.has(question.id))
    .map(question => ({
      text: question.text,
      choices: [...question.choices] as ExamQuestion['choices'],
      correctIndex: question.correctIndex,
      subject: question.subject,
      difficulty: question.difficulty,
      year: question.year,
    }));
  if (questions.length === 0) return null;
  return { title, questions };
}

export async function shareExamSet(gid: string, questionIds: string[], title: string): Promise<boolean> {
  const { userId, mode } = getAuthContext();
  if (mode !== 'authenticated') return false;
  const payload = buildExamSnapshot(questionIds, title);
  if (!payload) return false;
  const { error } = await supabase.from('group_shares').insert({
    group_id: gid,
    shared_by: userId,
    kind: 'exam_set',
    title,
    payload,
  });
  if (error) { toast.error(error.message); return false; }
  return true;
}

export async function importShare(
  share: GroupShare,
  opts?: { targetSubjectId?: string; newSubjectName?: string; title?: string; selectedIndices?: number[] },
): Promise<void> {
  const { userId, mode } = getAuthContext();
  if (mode !== 'authenticated') return;
  const createdAt = new Date().toISOString();

  if (share.kind === 'flashcard_deck') {
    const payload = share.payload as FlashcardDeckSnapshot;
    const existingSubjects = get(subjects);
    let subject = opts?.targetSubjectId
      ? existingSubjects.find(candidate => candidate.id === opts.targetSubjectId)
      : undefined;
    const requestedSubjectName = opts?.newSubjectName?.trim();
    const subjectName = requestedSubjectName || payload.subjectName?.trim() || get(t).groups.importedSubject;
    if (!subject) {
      subject = existingSubjects.find(candidate => candidate.name.toLocaleLowerCase() === subjectName.toLocaleLowerCase());
    }
    if (!subject) {
      const orderIndex = existingSubjects.reduce((max, candidate) => Math.max(max, candidate.orderIndex), -1) + 1;
      const preset = ALL_BUILTIN_PRESETS.get(subjectName.toLocaleLowerCase());
      const paletteColor = SUBJECT_COLOR_PALETTE[orderIndex % SUBJECT_COLOR_PALETTE.length];
      subject = {
        id: newId(),
        userId,
        name: subjectName,
        symbol: preset?.symbol ?? subjectName.replace(/\s+/g, '').slice(0, 2),
        color: preset?.color ?? paletteColor.hex,
        colorRgb: preset?.colorRgb ?? paletteColor.rgb,
        orderIndex,
      } satisfies Subject;
      await subjectsRepo.save(subject);
    }

    const topicName = opts?.title !== undefined ? opts.title.trim() : payload.topicName;
    let topic = get(topics).find(candidate =>
      candidate.subjectId === subject.id && candidate.name.toLocaleLowerCase() === topicName.toLocaleLowerCase()
    );
    if (!topic) {
      topic = {
        id: newId(),
        subjectId: subject.id,
        name: topicName,
        orderIndex: get(topics).filter(candidate => candidate.subjectId === subject.id)
          .reduce((max, candidate) => Math.max(max, candidate.orderIndex), -1) + 1,
      } satisfies Topic;
      await topicsRepo.create(topic);
    }

    const selected = opts?.selectedIndices ? new Set(opts.selectedIndices) : null;
    for (const [index, card] of payload.cards.entries()) {
      if (selected && !selected.has(index)) continue;
      await flashcardsRepo.save({
        id: newId(),
        userId,
        topicId: topic.id,
        front: card.front,
        back: card.back,
        createdAt,
      });
    }
  } else {
    const payload = share.payload as ExamSetSnapshot;
    const selected = opts?.selectedIndices ? new Set(opts.selectedIndices) : null;
    for (const [index, question] of payload.questions.entries()) {
      if (selected && !selected.has(index)) continue;
      await examQuestionsRepo.save({
        id: newId(),
        userId,
        text: question.text,
        choices: [...question.choices] as ExamQuestion['choices'],
        correctIndex: question.correctIndex,
        subject: question.subject,
        difficulty: question.difficulty,
        year: question.year,
        createdAt,
      });
    }
  }

  toast.success(get(t).groups.imported);
}
