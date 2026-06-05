import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { settings, defaults } from '$lib/stores/settings';
import { fmt } from '$lib/i18n/format';

const ISO = '2026-06-04T10:00:00.000Z';

beforeEach(() => settings.set(defaults()));

describe('fmt formatter store', () => {
  it('English uses en-US: English month + CE year', () => {
    settings.set({ ...defaults(), lang: 'en' });
    const s = get(fmt).date(ISO, { month: 'long', year: 'numeric' });
    expect(s).toContain('June');
    expect(s).toContain('2026');
  });

  it('Thai uses Thai month name + Gregorian (CE) year, not Buddhist Era', () => {
    settings.set({ ...defaults(), lang: 'th' });
    const s = get(fmt).date(ISO, { month: 'long', year: 'numeric' });
    expect(s).toContain('มิถุนายน'); // "June" in Thai
    expect(s).toContain('2026');     // CE year
    expect(s).not.toContain('2569'); // would be Buddhist Era
  });

  it('num formats with the active locale', () => {
    settings.set({ ...defaults(), lang: 'en' });
    expect(get(fmt).num(1234.5)).toBe('1,234.5');
  });
});
