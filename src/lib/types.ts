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
