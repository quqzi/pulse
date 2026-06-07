import { describe, it, expect } from 'vitest';
import { deckState, isDeckDue, presetDate } from '$lib/flashcards';

const today = '2026-06-07';

describe('deckState', () => {
  it('empty when no cards', () => {
    expect(deckState(undefined, 0, today)).toBe('empty');
    expect(deckState('2026-06-01', 0, today)).toBe('empty');
  });
  it('new when cards but no date', () => {
    expect(deckState(undefined, 3, today)).toBe('new');
  });
  it('due when date <= today', () => {
    expect(deckState('2026-06-07', 3, today)).toBe('due');
    expect(deckState('2026-06-01', 3, today)).toBe('due');
  });
  it('scheduled when date in the future', () => {
    expect(deckState('2026-06-20', 3, today)).toBe('scheduled');
  });
});

describe('isDeckDue', () => {
  it('true for new and due, false otherwise', () => {
    expect(isDeckDue('new')).toBe(true);
    expect(isDeckDue('due')).toBe(true);
    expect(isDeckDue('scheduled')).toBe(false);
    expect(isDeckDue('empty')).toBe(false);
  });
});

describe('presetDate', () => {
  it('adds days and formats YYYY-MM-DD', () => {
    expect(presetDate(today, 1)).toBe('2026-06-08');
    expect(presetDate(today, 7)).toBe('2026-06-14');
  });
});
