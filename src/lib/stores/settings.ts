import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light'|'dark'|'auto';
export type DesignTheme = 'vercel'|'apple'|'resend';

export interface Settings {
  theme: Theme;
  designTheme: DesignTheme;
  lang: 'en'|'th';
  dailyGoalHours: number;
  pomodoroWork: number;
  pomodoroBreak: number;
}

function defaults(): Settings {
  return { theme: 'auto', designTheme: 'vercel', lang: 'en', dailyGoalHours: 4, pomodoroWork: 25, pomodoroBreak: 5 };
}

function load(): Settings {
  if (!browser) return defaults();
  try {
    const raw = localStorage.getItem('pulse_settings');
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch { return defaults(); }
}

export const settings = writable<Settings>(load());

settings.subscribe(val => {
  if (browser) localStorage.setItem('pulse_settings', JSON.stringify(val));
});

export const resolvedTheme = derived(settings, ($s) => {
  if (!browser) return 'light';
  if ($s.theme !== 'auto') return $s.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
});
