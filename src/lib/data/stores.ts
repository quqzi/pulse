import { writable } from 'svelte/store';
import type { Subject, Topic, StudySession, Task, Template, ScheduleSlot, MockScore, ExamQuestion, ExamSession, Flashcard, Note, CustomGoal } from '$lib/types';

export const subjects = writable<Subject[]>([]);
export const topics = writable<Topic[]>([]);
export const sessions = writable<StudySession[]>([]);
export const tasks = writable<Task[]>([]);
export const templates = writable<Template[]>([]);
export const scheduleSlots = writable<ScheduleSlot[]>([]);
export const scores = writable<MockScore[]>([]);
export const examQuestions = writable<ExamQuestion[]>([]);
export const examSessions = writable<ExamSession[]>([]);
export const flashcards = writable<Flashcard[]>([]);
export const notes = writable<Note[]>([]);
export const customGoals = writable<CustomGoal[]>([]);
