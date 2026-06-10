export type DeckState = 'empty' | 'new' | 'due' | 'scheduled';

/** A topic is a deck. State from its card count and manual nextStudyDate. */
export function deckState(nextStudyDate: string | undefined, cardCount: number, today: string): DeckState {
  if (cardCount === 0) return 'empty';
  if (!nextStudyDate) return 'new';
  return nextStudyDate <= today ? 'due' : 'scheduled';
}

/** Decks needing study now: have cards and are new or due. */
export function isDeckDue(state: DeckState): boolean {
  return state === 'new' || state === 'due';
}

/** Preset next-study date `days` from today (YYYY-MM-DD). Local-component math
 *  avoids the UTC day-shift that `toISOString()` causes in non-UTC timezones. */
export function presetDate(today: string, days: number): string {
  const d = new Date(today + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
