import { derived } from 'svelte/store';
import { settings } from '$lib/stores/settings';

export interface Formatter {
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
}

// `-u-ca-gregory` forces a Gregorian (CE) year on the Thai locale, which would
// otherwise default to the Buddhist Era. Thai month/day names are preserved.
export const fmt = derived(settings, ($s): Formatter => {
  const locale = $s.lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-US';
  return {
    date: (iso, opts) => new Intl.DateTimeFormat(locale, opts).format(new Date(iso)),
    num: (n, opts) => new Intl.NumberFormat(locale, opts).format(n),
  };
});
