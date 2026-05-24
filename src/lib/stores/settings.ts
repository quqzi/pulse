import { writable } from 'svelte/store';
import { browser } from '$app/environment';

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
}

function defaults(): Settings {
  return { theme: 'vercel-light', lang: 'en', dailyGoalHours: 4, pomodoroWork: 25, pomodoroBreak: 5 };
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
  if (browser) localStorage.setItem('pulse_settings', JSON.stringify(val));
});
