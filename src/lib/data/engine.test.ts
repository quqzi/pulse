import { describe, it, expect, vi } from 'vitest';
import { writable, get } from 'svelte/store';
import { createRepository } from '$lib/data/engine';
import { mockAdapter, type MockAdapter } from '$lib/data/adapters/mock';

type Row = { id: string; n: number };

function deps(adapter: MockAdapter<Row>, onError: (m: string) => void = () => {}) {
  return {
    getMode: () => 'guest' as const,
    selectAdapter: () => adapter,
    onError,
  };
}

describe('createRepository', () => {
  it('load sets the store from the adapter, sorted by the configured order', async () => {
    const store = writable<Row[]>([]);
    const adapter = mockAdapter<Row>([{ id: 'b', n: 2 }, { id: 'a', n: 1 }]);
    const repo = createRepository<Row>({ store, order: (x, y) => x.n - y.n }, deps(adapter));
    const out = await repo.load();
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
    expect(get(store).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('save upserts into the store and persists via the adapter', async () => {
    const store = writable<Row[]>([{ id: 'a', n: 1 }]);
    const adapter = mockAdapter<Row>([{ id: 'a', n: 1 }]);
    const repo = createRepository<Row>({ store }, deps(adapter));
    await repo.save({ id: 'b', n: 2 });
    expect(get(store)).toContainEqual({ id: 'b', n: 2 });
    expect(adapter.data).toContainEqual({ id: 'b', n: 2 });
  });

  it('reverts the store and reports an error when a save fails', async () => {
    const store = writable<Row[]>([{ id: 'a', n: 1 }]);
    const adapter = mockAdapter<Row>([{ id: 'a', n: 1 }]);
    adapter.failSave = true;
    const onError = vi.fn();
    const repo = createRepository<Row>({ store }, deps(adapter, onError));
    await repo.save({ id: 'b', n: 2 });
    expect(get(store)).toEqual([{ id: 'a', n: 1 }]); // rolled back
    expect(onError).toHaveBeenCalledOnce();
  });

  it('remove deletes optimistically and reverts on failure', async () => {
    const store = writable<Row[]>([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
    const adapter = mockAdapter<Row>([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
    const onError = vi.fn();
    const repo = createRepository<Row>({ store }, deps(adapter, onError));
    await repo.remove('a');
    expect(get(store).map((r) => r.id)).toEqual(['b']);
    adapter.failRemove = true;
    await repo.remove('b');
    expect(get(store).map((r) => r.id)).toEqual(['b']); // reverted
    expect(onError).toHaveBeenCalledOnce();
  });

  it('leaves the store unchanged and does not throw on read error', async () => {
    const store = writable<Row[]>([{ id: 'a', n: 1 }]);
    const adapter = mockAdapter<Row>([]);
    adapter.failList = true;
    const repo = createRepository<Row>({ store }, deps(adapter));
    await expect(repo.load()).resolves.toEqual([{ id: 'a', n: 1 }]);
    expect(get(store)).toEqual([{ id: 'a', n: 1 }]);
  });

  it('routes to the adapter for the current mode', async () => {
    const store = writable<Row[]>([]);
    const guest = mockAdapter<Row>([{ id: 'g', n: 1 }]);
    const auth = mockAdapter<Row>([{ id: 'u', n: 1 }]);
    let mode: 'guest' | 'authenticated' = 'guest';
    const repo = createRepository<Row>(
      { store },
      { getMode: () => mode, selectAdapter: (m) => (m === 'guest' ? guest : auth), onError: () => {} },
    );
    await repo.load();
    expect(get(store).map((r) => r.id)).toEqual(['g']);
    mode = 'authenticated';
    await repo.load();
    expect(get(store).map((r) => r.id)).toEqual(['u']);
  });
});
