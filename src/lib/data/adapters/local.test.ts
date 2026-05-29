import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { localAdapter } from '$lib/data/adapters/local';

type Row = { id: string; n: number };

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('localAdapter', () => {
  it('returns [] for an empty key and persists saves', async () => {
    const a = localAdapter<Row>('pulse.test');
    expect(await a.list()).toEqual([]);
    await a.save({ id: 'a', n: 1 });
    await a.save({ id: 'b', n: 2 });
    expect(await a.list()).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
  });

  it('upserts by id', async () => {
    const a = localAdapter<Row>('pulse.test');
    await a.save({ id: 'a', n: 1 });
    await a.save({ id: 'a', n: 9 });
    expect(await a.list()).toEqual([{ id: 'a', n: 9 }]);
  });

  it('removes by id', async () => {
    const a = localAdapter<Row>('pulse.test');
    await a.save({ id: 'a', n: 1 });
    await a.save({ id: 'b', n: 2 });
    await a.remove('a');
    expect(await a.list()).toEqual([{ id: 'b', n: 2 }]);
  });
});
