import { writable } from 'svelte/store';

export type ToastKind = 'error' | 'success' | 'info';
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

export const toasts = writable<Toast[]>([]);

let seq = 0;

function push(kind: ToastKind, message: string, ttlMs = 4000): string {
  const id = `t${++seq}`;
  toasts.update((list) => [...list, { id, kind, message }]);
  if (ttlMs > 0) setTimeout(() => dismissToast(id), ttlMs);
  return id;
}

export function dismissToast(id: string): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
  info: (message: string) => push('info', message),
};
