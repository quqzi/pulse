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

export interface ScheduleSlot {
  id: string;
  userId: string;
  subjectId?: string;
  topicId?: string;
  startTime: string;          // local ISO: "2026-05-19T08:00:00"
  endTime: string;            // local ISO: "2026-05-19T09:30:00"
  isAiSuggested: boolean;
  isConfirmed: boolean;
  isFocusBlock: boolean;
  isRecurring: boolean;
  recurrenceDays: number[];   // [1,3,5] = Mon/Wed/Fri
  recurrenceEndDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface IdealWeekSlot {
  id: string;
  userId: string;
  subjectId: string;
  dayOfWeek: number;       // 0=Sun … 6=Sat
  startHour: number;
  startMinute: number;
  durationMinutes: number;
}

export interface MockScore {
  id: string;
  userId: string;
  subjectId: string;
  score: number;        // raw score, e.g. 42
  maxScore: number;     // max possible, e.g. 60
  takenAt: string;      // YYYY-MM-DD
  notes?: string;
  createdAt: string;    // ISO timestamp
}
