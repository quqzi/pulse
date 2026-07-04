import type { Adapter } from '$lib/data/engine';
import { lsRead, lsWrite } from '$lib/data/ls';

/** localStorage-backed adapter. Stores a JSON array of camelCase entities under `lsKey`. */
export function localAdapter<T extends { id: string }>(lsKey: string): Adapter<T> {
  return {
    async list() {
      return lsRead<T>(lsKey);
    },
    async save(item) {
      const all = lsRead<T>(lsKey);
      const i = all.findIndex((x) => x.id === item.id);
      if (i >= 0) all[i] = item;
      else all.push(item);
      lsWrite(lsKey, all);
    },
    async saveMany(items) {
      const all = lsRead<T>(lsKey);
      const byId = new Map(all.map((item) => [item.id, item]));
      for (const item of items) byId.set(item.id, item);
      lsWrite(lsKey, [...byId.values()]);
    },
    async remove(id) {
      lsWrite(lsKey, lsRead<T>(lsKey).filter((x) => x.id !== id));
    },
  };
}
