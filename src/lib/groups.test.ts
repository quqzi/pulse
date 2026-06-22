import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writable, type Writable } from 'svelte/store';
import type { ExamQuestion, Flashcard, Subject, Topic } from '$lib/types';
import type { GroupShare } from '$lib/groups';

interface Harness {
  subjects: Writable<Subject[]>;
  topics: Writable<Topic[]>;
  subjectsSave: ReturnType<typeof vi.fn>;
  topicsCreate: ReturnType<typeof vi.fn>;
  flashcardsSave: ReturnType<typeof vi.fn>;
  examQuestionsSave: ReturnType<typeof vi.fn>;
}

async function setup(initialSubjects: Subject[] = [], initialTopics: Topic[] = []) {
  const subjects = writable(initialSubjects);
  const topics = writable(initialTopics);
  const flashcards = writable<Flashcard[]>([]);
  const examQuestions = writable<ExamQuestion[]>([]);
  const subjectsSave = vi.fn(async (subject: Subject) => subjects.update(items => [...items, subject]));
  const topicsCreate = vi.fn(async (topic: Topic) => topics.update(items => [...items, topic]));
  const flashcardsSave = vi.fn();
  const examQuestionsSave = vi.fn();
  let id = 0;

  vi.doMock('$lib/supabase', () => ({ supabase: {} }));
  vi.doMock('$lib/achievements', () => ({ computeAchievements: vi.fn(() => []) }));
  vi.doMock('$lib/data/entities', () => ({
    subjectsRepo: { save: subjectsSave },
    topicsRepo: { create: topicsCreate },
    flashcardsRepo: { save: flashcardsSave },
    examQuestionsRepo: { save: examQuestionsSave },
  }));
  vi.doMock('$lib/id', () => ({ newId: () => `new-${++id}` }));
  vi.doMock('$lib/i18n', () => ({
    t: writable({ groups: { importedSubject: 'Imported', imported: 'Imported successfully' } }),
  }));
  vi.doMock('$lib/stores/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
  vi.doMock('$lib/stores/data', () => ({
    subjects,
    topics,
    flashcards,
    examQuestions,
    getAuthContext: () => ({ userId: 'user-1', mode: 'authenticated' }),
  }));

  const { importShare } = await import('$lib/groups');
  const harness: Harness = {
    subjects,
    topics,
    subjectsSave,
    topicsCreate,
    flashcardsSave,
    examQuestionsSave,
  };
  return { importShare, harness };
}

function flashcardShare(): GroupShare {
  return {
    id: 'share-1',
    groupId: 'group-1',
    sharedBy: 'user-2',
    kind: 'flashcard_deck',
    title: 'Original deck',
    payload: {
      topicName: 'Original deck',
      subjectName: 'Shared subject',
      cards: [
        { front: 'front 1', back: 'back 1' },
        { front: 'front 2', back: 'back 2' },
      ],
    },
    createdAt: '2026-06-22T00:00:00.000Z',
  };
}

function examShare(): GroupShare {
  return {
    id: 'share-2',
    groupId: 'group-1',
    sharedBy: 'user-2',
    kind: 'exam_set',
    title: 'Original exam',
    payload: {
      title: 'Original exam',
      questions: [
        { text: 'Question 1', choices: ['A', 'B', 'C', 'D'], correctIndex: 0, subject: 'Math', difficulty: 'easy', year: 2025 },
        { text: 'Question 2', choices: ['A', 'B', 'C', 'D'], correctIndex: 1, subject: 'Physics', difficulty: 'hard', year: 2024 },
      ],
    },
    createdAt: '2026-06-22T00:00:00.000Z',
  };
}

describe('importShare options', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('imports selected cards into an existing target subject with the overridden title', async () => {
    const subject: Subject = {
      id: 'subject-1', userId: 'user-1', name: 'Math', symbol: 'M', color: 'token', colorRgb: '0,0,0', orderIndex: 0,
    };
    const { importShare, harness } = await setup([subject]);

    await importShare(flashcardShare(), {
      targetSubjectId: subject.id,
      title: '  Renamed deck  ',
      selectedIndices: [1],
    });

    expect(harness.subjectsSave).not.toHaveBeenCalled();
    expect(harness.topicsCreate).toHaveBeenCalledWith(expect.objectContaining({ subjectId: subject.id, name: 'Renamed deck' }));
    expect(harness.flashcardsSave).toHaveBeenCalledTimes(1);
    expect(harness.flashcardsSave).toHaveBeenCalledWith(expect.objectContaining({ front: 'front 2', back: 'back 2' }));
  });

  it('deduplicates a requested new subject name before creating one', async () => {
    const subject: Subject = {
      id: 'subject-2', userId: 'user-1', name: 'Biology', symbol: 'Bi', color: 'token', colorRgb: '0,0,0', orderIndex: 0,
    };
    const { importShare, harness } = await setup([subject]);

    await importShare(flashcardShare(), { newSubjectName: ' biology ', selectedIndices: [0] });

    expect(harness.subjectsSave).not.toHaveBeenCalled();
    expect(harness.topicsCreate).toHaveBeenCalledWith(expect.objectContaining({ subjectId: subject.id }));
  });

  it('imports only selected exam questions and preserves their subject tags', async () => {
    const { importShare, harness } = await setup();

    await importShare(examShare(), { title: 'Renamed exam', selectedIndices: [1] });

    expect(harness.examQuestionsSave).toHaveBeenCalledTimes(1);
    expect(harness.examQuestionsSave).toHaveBeenCalledWith(expect.objectContaining({ text: 'Question 2', subject: 'Physics' }));
  });
});
