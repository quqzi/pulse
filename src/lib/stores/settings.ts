import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { authCtx } from '$lib/data/authctx';

export type Theme =
  | 'vercel-light'
  | 'vercel-dark'
  | 'apple-light'
  | 'apple-dark'
  | 'resend';

export interface Settings {
  theme: Theme;
  lang: 'en'|'th';
  dailyGoalHours: number;
  pomodoroWork: number;
  pomodoroBreak: number;
  schoolHoursEnabled: boolean;
  schoolDays: number[];        // [1,2,3,4,5] = Mon–Fri
  schoolStart: string;         // "08:00"
  schoolEnd: string;           // "15:30"
  energyProfile: 'morning' | 'evening' | 'neutral';
  bufferMinutes: number;
  examName: string | null;     // e.g. "TCAS 68" — shown in the countdown
  examDate: string | null;
  studyStart: string;          // "06:00" — earliest auto-scheduled block
  studyEnd: string;            // "22:00" — latest auto-scheduled block end
  blockMinutes: number;        // preferred max block length (45 | 60 | 90)
  maxBlocksPerDay: number;     // 0 = no cap
  restDays: number[];          // 1–7 Mon–Sun; auto-schedule leaves these free
  subjectWeights: Record<string, number>; // subjectId → 0.5 | 1 | 2 (default 1)
  readinessHoursTarget: number; // hours per subject per 30 days = full hours score
  musicUrl: string;            // study-music link (YouTube/Spotify/SoundCloud/Apple); '' = none
  // Study reminders (fire while Pulse is open; needs OS notification permission)
  notifyEnabled: boolean;      // master switch
  notifyBlockStart: boolean;   // a scheduled study block is starting
  notifyDaily: boolean;        // daily study nudge at notifyDailyTime
  notifyDailyTime: string;     // "19:00"
  notifyTasksDue: boolean;     // tasks due today (folded into the daily nudge)
  notifyStreak: boolean;       // evening nudge when the streak is at risk
}

export function defaults(): Settings {
  return {
    theme: 'vercel-light',
    lang: 'en',
    dailyGoalHours: 4,
    pomodoroWork: 25,
    pomodoroBreak: 5,
    schoolHoursEnabled: false,
    schoolDays: [1, 2, 3, 4, 5],
    schoolStart: '08:00',
    schoolEnd: '15:30',
    energyProfile: 'neutral',
    bufferMinutes: 10,
    examName: null,
    examDate: null,
    studyStart: '06:00',
    studyEnd: '22:00',
    blockMinutes: 90,
    maxBlocksPerDay: 0,
    restDays: [],
    subjectWeights: {},
    readinessHoursTarget: 20,
    musicUrl: '',
    notifyEnabled: false,
    notifyBlockStart: true,
    notifyDaily: true,
    notifyDailyTime: '19:00',
    notifyTasksDue: true,
    notifyStreak: true,
  };
}

/** Pure: overlay a (possibly partial / absent) remote settings blob onto a fresh defaults(). */
export function mergeRemote(remote: Partial<Settings> | null | undefined): Settings {
  return { ...defaults(), ...(remote ?? {}) };
}

function load(): Settings {
  if (!browser) return defaults();
  try {
    const raw = localStorage.getItem('pulse_settings');
    if (!raw) return defaults();
    const saved = JSON.parse(raw);
    // Migrate old designTheme+theme fields to new unified theme value
    if (saved.designTheme || (saved.theme && !String(saved.theme).includes('-') && saved.theme !== 'resend')) {
      const design: string = saved.designTheme ?? 'vercel';
      const mode = saved.theme === 'dark' ? 'dark' : 'light';
      saved.theme = design === 'resend' ? 'resend' : `${design}-${mode}`;
      delete saved.designTheme;
      delete saved.palette;
    }
    return { ...defaults(), ...saved };
  } catch { return defaults(); }
}

export const settings = writable<Settings>(load());

settings.subscribe(val => {
  if (browser && get(authCtx).mode !== 'authenticated') {
    localStorage.setItem('pulse_settings', JSON.stringify(val));
  }
});
