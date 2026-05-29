import type { Adapter } from '$lib/data/engine';

/**
 * localStorage-backed adapter. Stores a JSON array of camelCase entities under `lsKey`.
 * Uses a `typeof localStorage` guard instead of $app/environment so it stays importable in Node tests.
 */
export function localAdapter<T extends { id: string }>(lsKey: string): Adapter<T> {
  const read = (): T[] => {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(lsKey) ?? '[]') as T[];
    } catch {
      return [];
    }
  };
  const write = (items: T[]): void => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(lsKey, JSON.stringify(items));
  };

  return {
    async list() {
      return read();
    },
    async save(item) {
      const all = read();
      const i = all.findIndex((x) => x.id === item.id);
      if (i >= 0) all[i] = item;
      else all.push(item);
      write(all);
    },
    async remove(id) {
      write(read().filter((x) => x.id !== id));
    },
  };
}
