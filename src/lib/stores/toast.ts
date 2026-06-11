import { writable } from 'svelte/store';

export type ToastKind = 'error' | 'success' | 'info';
export interface ToastAction { label: string; fn: () => void | Promise<void> }
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

export const toasts = writable<Toast[]>([]);

let seq = 0;

function push(kind: ToastKind, message: string, action?: ToastAction, ttlMs = action ? 6000 : 4000): string {
  const id = `t${++seq}`;
  toasts.update((list) => [...list, { id, kind, message, action }]);
  if (ttlMs > 0) setTimeout(() => dismissToast(id), ttlMs);
  return id;
}

export function dismissToast(id: string): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export function runToastAction(id: string): void {
  let act: ToastAction | undefined;
  toasts.update((list) => {
    act = list.find((t) => t.id === id)?.action;
    return list.filter((t) => t.id !== id);
  });
  void act?.fn();
}

export const toast = {
  error: (message: string, action?: ToastAction) => push('error', message, action),
  success: (message: string, action?: ToastAction) => push('success', message, action),
  info: (message: string, action?: ToastAction) => push('info', message, action),
};
