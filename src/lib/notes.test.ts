import { describe, it, expect } from 'vitest';
import { normalizeTags, filterNotes } from '$lib/notes';
import type { Note } from '$lib/types';

const mk = (over: Partial<Note>): Note => ({
  id: 'x', userId: 'u', subjectId: undefined, title: '', body: '',
  tags: [], pinned: false,
  createdAt: '2026-06-26T10:00:00.000Z', updatedAt: '2026-06-26T10:00:00.000Z',
  ...over,
});

describe('normalizeTags', () => {
  it('trims, lowercases, drops empties, de-dupes', () => {
    expect(normalizeTags([' Physics ', 'physics', '', '  ', 'MATH'])).toEqual(['physics', 'math']);
  });
});

describe('filterNotes', () => {
  const a = mk({ id: 'a', title: 'Newton laws', body: 'force = ma', subjectId: 's1', tags: ['physics'], updatedAt: '2026-06-26T12:00:00.000Z' });
  const b = mk({ id: 'b', title: 'Cells', body: 'mitochondria', subjectId: 's2', tags: ['bio'], updatedAt: '2026-06-26T13:00:00.000Z' });
  const c = mk({ id: 'c', title: 'Scratch', body: 'misc', subjectId: undefined, tags: ['physics'], pinned: true, updatedAt: '2026-06-26T09:00:00.000Z' });
  const all = [a, b, c];

  it('sorts pinned first, then updatedAt desc', () => {
    expect(filterNotes(all, {}).map(n => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('search matches title and body, case-insensitive', () => {
    expect(filterNotes(all, { query: 'NEWTON' }).map(n => n.id)).toEqual(['a']);
    expect(filterNotes(all, { query: 'mitochon' }).map(n => n.id)).toEqual(['b']);
  });

  it('subjectId null filters to Unfiled', () => {
    expect(filterNotes(all, { subjectId: null }).map(n => n.id)).toEqual(['c']);
  });

  it('subjectId id filters to that subject', () => {
    expect(filterNotes(all, { subjectId: 's2' }).map(n => n.id)).toEqual(['b']);
  });

  it('tag filter requires the tag', () => {
    expect(filterNotes(all, { tag: 'physics' }).map(n => n.id)).toEqual(['c', 'a']);
  });

  it('combines filters', () => {
    expect(filterNotes(all, { tag: 'physics', subjectId: 's1' }).map(n => n.id)).toEqual(['a']);
  });
});
