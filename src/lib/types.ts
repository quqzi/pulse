export interface Subject {
  id: string;
  userId: string;
  name: string;
  symbol: string;
  color: string;
  colorRgb: string;
  orderIndex: number;
  targetScore?: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  orderIndex: number;
}

export interface SrsCard {
  id: string;
  topicId: string;
  userId: string;
  ease: number;
  intervalDays: number;
  dueDate: string;   // YYYY-MM-DD
  reps: number;
}

export type StudyMode = 'pomodoro' | 'free' | 'quick';

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  topicId?: string;
  startedAt: string;   // ISO timestamp
  endedAt: string;     // ISO timestamp
  durationSec: number;
  mode: StudyMode;
}

export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  userId: string;
  subjectId?: string;
  title: string;
  priority: Priority;
  dueDate?: string;      // YYYY-MM-DD
  completedAt?: string;  // ISO timestamp, undefined = incomplete
  createdAt: string;     // ISO timestamp
}

export interface SubjectPreset {
  name: string;
  symbol: string;
  color: string;
  colorRgb: string;
}

export interface Template {
  id: string;
  userId: string;  // 'builtin' for built-ins
  name: string;
  presets: SubjectPreset[];
  createdAt: string;
}
