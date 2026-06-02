export interface Point {
  x: number;
  y: number;
}

export interface GestureState {
  origin: Point;
  started: boolean;
  /** true once a touch long-press has "grabbed"; mouse leaves this false and relies on threshold */
  grabbed: boolean;
}

export interface GestureConfig {
  /** px of movement before a (non-grabbed) drag starts */
  threshold: number;
}

export interface GestureResult {
  state: GestureState;
  emit: 'start' | 'move' | null;
  dx: number;
  dy: number;
}

export function createGesture(origin: Point, grabbed: boolean): GestureState {
  return { origin, started: false, grabbed };
}

export function moveGesture(state: GestureState, point: Point, cfg: GestureConfig): GestureResult {
  const dx = point.x - state.origin.x;
  const dy = point.y - state.origin.y;

  if (state.started) {
    return { state, emit: 'move', dx, dy };
  }
  const past = state.grabbed || Math.hypot(dx, dy) >= cfg.threshold;
  if (past) {
    return { state: { ...state, started: true }, emit: 'start', dx, dy };
  }
  return { state, emit: null, dx, dy };
}
