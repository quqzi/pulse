import { createGesture, moveGesture, type GestureState, type Point } from './dragGesture';

export interface DraggableOptions {
  /** px of movement (mouse) before a drag begins. Default 4. */
  threshold?: number;
  /** ms a touch/pen must be held before a drag can begin. Default 250. */
  longPressMs?: number;
  onStart?: (e: PointerEvent) => void;
  onMove?: (detail: { dx: number; dy: number; event: PointerEvent }) => void;
  /** dragged = true if a real drag occurred (so the consumer can suppress the click). */
  onEnd?: (detail: { dragged: boolean; event: PointerEvent }) => void;
}

const DEFAULTS = { threshold: 4, longPressMs: 250 };

export function draggable(node: HTMLElement, options: DraggableOptions = {}) {
  let opts = { ...DEFAULTS, ...options };
  let state: GestureState | null = null;
  let activeId: number | null = null;
  let longPress: ReturnType<typeof setTimeout> | null = null;

  function clearLongPress() {
    if (longPress) { clearTimeout(longPress); longPress = null; }
  }

  function onPointerdown(e: PointerEvent) {
    if (activeId !== null) return;       // already tracking a pointer
    if (e.button > 0) return;            // primary button / touch only
    activeId = e.pointerId;
    state = createGesture({ x: e.clientX, y: e.clientY }, false);
    node.setPointerCapture(e.pointerId);
    node.addEventListener('pointermove', onPointermove);
    node.addEventListener('pointerup', onPointerup);
    node.addEventListener('pointercancel', onPointerup);

    if (e.pointerType !== 'mouse') {
      longPress = setTimeout(() => {
        longPress = null;
        if (state && !state.started) {
          state = { ...state, grabbed: true, started: true };
          opts.onStart?.(e);
        }
      }, opts.longPressMs);
    }
  }

  function onPointermove(e: PointerEvent) {
    if (state === null || e.pointerId !== activeId) return;
    const point: Point = { x: e.clientX, y: e.clientY };

    // Touch that moves before the long-press fires = the user is scrolling; abandon.
    if (!state.started && e.pointerType !== 'mouse' && !state.grabbed) {
      const moved = Math.hypot(point.x - state.origin.x, point.y - state.origin.y);
      if (moved > 10) { clearLongPress(); end(e, false); return; }
      return;
    }

    const res = moveGesture(state, point, { threshold: opts.threshold });
    state = res.state;
    if (res.emit === 'start') opts.onStart?.(e);
    if (res.emit !== null) {
      e.preventDefault();
      opts.onMove?.({ dx: res.dx, dy: res.dy, event: e });
    }
  }

  function onPointerup(e: PointerEvent) {
    if (e.pointerId !== activeId) return;
    clearLongPress();
    end(e, !!state?.started);
  }

  function end(e: PointerEvent, dragged: boolean) {
    opts.onEnd?.({ dragged, event: e });
    node.removeEventListener('pointermove', onPointermove);
    node.removeEventListener('pointerup', onPointerup);
    node.removeEventListener('pointercancel', onPointerup);
    try { node.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    state = null;
    activeId = null;
  }

  node.addEventListener('pointerdown', onPointerdown);
  node.style.touchAction = 'none';

  return {
    update(next: DraggableOptions) { opts = { ...DEFAULTS, ...next }; },
    destroy() {
      clearLongPress();
      node.removeEventListener('pointerdown', onPointerdown);
    },
  };
}
