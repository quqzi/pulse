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
  done?: boolean;   // covered checkbox; absent/false = not covered
  note?: string;    // short free-text note; absent/'' = no note
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
  topics?: string[];
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

export interface ExamQuestion {
  id: string;
  userId: string;
  text: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  subject: string;      // subject name (questions are authored free-form)
  difficulty: 'easy' | 'medium' | 'hard';
  year?: number;
  createdAt: string;    // ISO timestamp
}

export interface ExamSession {
  id: string;
  userId: string;
  subjectScores: Record<string, { correct: number; total: number }>;  // keyed by subject id
  totalCorrect: number;
  totalQuestions: number;
  durationSeconds: number;
  timerMode: 'overall' | 'per-question';
  createdAt: string;    // ISO timestamp
}
