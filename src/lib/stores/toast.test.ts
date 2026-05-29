import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { toasts, toast, dismissToast } from '$lib/stores/toast';

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
});
