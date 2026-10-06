// 스냅샷 방식 Undo/Redo. 문서는 불변으로 다루므로 스냅샷끼리 대부분의 객체를 공유해 비용이 작다.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const HISTORY_LIMIT = 100;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** 새 상태를 기록한다. 같은 객체면 아무것도 하지 않는다. */
export function pushHistory<T>(h: History<T>, next: T, limit = HISTORY_LIMIT): History<T> {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

/** 기록 없이 현재 상태만 바꾼다 (드래그 도중, 배치안 전환 등). */
export function replacePresent<T>(h: History<T>, next: T): History<T> {
  return next === h.present ? h : { ...h, present: next };
}

/**
 * 드래그처럼 여러 번의 replacePresent로 이루어진 동작을 Undo 한 단위로 묶는다.
 * base는 동작을 시작할 때의 present.
 */
export function commitGesture<T>(h: History<T>, base: T, limit = HISTORY_LIMIT): History<T> {
  if (h.present === base) return h;
  return { past: [...h.past, base].slice(-limit), present: h.present, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
