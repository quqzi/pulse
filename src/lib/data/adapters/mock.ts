import type { Adapter } from '$lib/data/engine';

export interface MockAdapter<T> extends Adapter<T> {
  data: T[];
  failList: boolean;
  failSave: boolean;
  failRemove: boolean;
}

/** In-memory adapter for unit tests. Toggle failList/failSave/failRemove to simulate errors. */
export function mockAdapter<T extends { id: string }>(seed: T[] = []): MockAdapter<T> {
  const a: MockAdapter<T> = {
    data: [...seed],
    failList: false,
    failSave: false,
    failRemove: false,
    async list() {
      if (a.failList) throw new Error('mock list error');
      return [...a.data];
    },
    async save(item) {
      if (a.failSave) throw new Error('mock save error');
      const i = a.data.findIndex((x) => x.id === item.id);
      if (i >= 0) a.data[i] = item;
      else a.data.push(item);
    },
    async remove(id) {
      if (a.failRemove) throw new Error('mock remove error');
      a.data = a.data.filter((x) => x.id !== id);
    },
  };
  return a;
}
