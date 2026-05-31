import { get, type Writable } from 'svelte/store';

export type Mode = 'guest' | 'authenticated';

/** Storage backend for one entity. Implemented by local (WS1.2), supabase (WS1.3), mock (tests). */
export interface Adapter<T> {
  list(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface RepoConfig<T extends { id: string }> {
  store: Writable<T[]>;
  /** Optional client-side sort applied after every load and write-through. */
  order?: (a: T, b: T) => number;
}

/** Injected so the engine (and its tests) never import $env/$app via supabase/authCtx. */
export interface RepoDeps<T extends { id: string }> {
  getMode(): Mode;
  selectAdapter(mode: Mode): Adapter<T>;
  onError(message: string): void;
}

export interface Repository<T extends { id: string }> {
  load(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createRepository<T extends { id: string }>(
  cfg: RepoConfig<T>,
  deps: RepoDeps<T>,
): Repository<T> {
  const sort = (items: T[]): T[] => (cfg.order ? [...items].sort(cfg.order) : items);
  const adapter = (): Adapter<T> => deps.selectAdapter(deps.getMode());

  function upsert(arr: T[], item: T): T[] {
    const i = arr.findIndex((x) => x.id === item.id);
    const next = i >= 0 ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item];
    return sort(next);
  }

  return {
    // Read-empty-on-error (G13): never reject; leave the store at its prior value on failure.
    async load() {
      try {
        const items = sort(await adapter().list());
        cfg.store.set(items);
        return items;
      } catch {
        return get(cfg.store);
      }
    },

    // Optimistic write-through with rollback (G8): the repo owns failure (no re-throw).
    async save(item) {
      const snapshot = get(cfg.store);
      cfg.store.set(upsert(snapshot, item));
      try {
        await adapter().save(item);
      } catch {
        cfg.store.set(snapshot);
        deps.onError("Couldn't save — try again");
      }
    },

    async remove(id) {
      const snapshot = get(cfg.store);
      cfg.store.set(snapshot.filter((x) => x.id !== id));
      try {
        await adapter().remove(id);
      } catch {
        cfg.store.set(snapshot);
        deps.onError("Couldn't delete — try again");
      }
    },
  };
}

/** Read into a store with the read-empty-on-error contract (G13). Used by windowed bespoke reads. */
export async function loadInto<T>(
  store: Writable<T[]>,
  fetch: () => Promise<T[]>,
  order?: (a: T, b: T) => number,
): Promise<T[]> {
  try {
    const items = await fetch();
    store.set(order ? [...items].sort(order) : items);
    return items;
  } catch {
    return get(store);
  }
}

/** Optimistic write-through with rollback (G8) for bespoke writes that the generic save/remove don't cover. */
export async function writeThrough<T>(
  store: Writable<T[]>,
  optimistic: (arr: T[]) => T[],
  persist: () => Promise<void>,
  opts: { order?: (a: T, b: T) => number; onError: (message: string) => void; errorMsg?: string },
): Promise<void> {
  const snapshot = get(store);
  const next = optimistic(snapshot);
  store.set(opts.order ? [...next].sort(opts.order) : next);
  try {
    await persist();
  } catch {
    store.set(snapshot);
    opts.onError(opts.errorMsg ?? "Couldn't save — try again");
  }
}
