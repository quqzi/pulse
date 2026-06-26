import type { Note } from '$lib/types';

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

interface FilterOpts {
  query?: string;
  subjectId?: string | null;
  tag?: string | null;
}

export function filterNotes(list: Note[], opts: FilterOpts): Note[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  return list
    .filter((n) => {
      if (q && !(n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))) return false;
      if (opts.subjectId === null && n.subjectId !== undefined) return false;
      if (typeof opts.subjectId === 'string' && n.subjectId !== opts.subjectId) return false;
      if (opts.tag && !n.tags.includes(opts.tag)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}
