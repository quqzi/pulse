import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { toasts, toast, dismissToast, runToastAction } from '$lib/stores/toast';

beforeEach(() => {
  vi.useFakeTimers();
  toasts.set([]);
});
afterEach(() => vi.useRealTimers());

describe('toast store', () => {
  it('pushes a toast and auto-dismisses after the ttl', () => {
    toast.error('boom');
    expect(get(toasts)).toHaveLength(1);
    expect(get(toasts)[0]).toMatchObject({ kind: 'error', message: 'boom' });
    vi.advanceTimersByTime(4000);
    expect(get(toasts)).toHaveLength(0);
  });

  it('dismiss removes a specific toast', () => {
    const id = toast.success('ok');
    expect(get(toasts)).toHaveLength(1);
    dismissToast(id);
    expect(get(toasts)).toHaveLength(0);
  });

  it('carries an action and removes the toast when the action runs', () => {
    const fn = vi.fn();
    const id = toast.success('Deleted', { label: 'Undo', fn });
    expect(get(toasts).find(t => t.id === id)?.action?.label).toBe('Undo');
    runToastAction(id);
    expect(fn).toHaveBeenCalledOnce();
    expect(get(toasts).find(t => t.id === id)).toBeUndefined();
  });

  it('action toasts get a longer ttl', () => {
    toast.success('Deleted', { label: 'Undo', fn: () => {} });
    vi.advanceTimersByTime(4000);
    expect(get(toasts)).toHaveLength(1); // still alive past the normal 4s
    vi.advanceTimersByTime(2000);
    expect(get(toasts)).toHaveLength(0);
  });
});
