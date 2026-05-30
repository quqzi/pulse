import { writable } from 'svelte/store';
import type { Subject, Topic, SrsCard, StudySession, Task, Template, ScheduleSlot, MockScore } from '$lib/types';

export const subjects = writable<Subject[]>([]);
export const topics = writable<Topic[]>([]);
export const srsCards = writable<SrsCard[]>([]);
export const sessions = writable<StudySession[]>([]);
export const tasks = writable<Task[]>([]);
export const templates = writable<Template[]>([]);
export const scheduleSlots = writable<ScheduleSlot[]>([]);
export const scores = writable<MockScore[]>([]);
