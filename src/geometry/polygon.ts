import type { Vec2 } from '../model/types';

/**
 * 신발끈 공식 면적. y가 아래로 향하는 화면 좌표에서는 시계방향으로 보이는 다각형이 양수가 된다.
 */
export function signedArea(pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** 화면상 시계방향(=signedArea 양수)으로 정규화 */
export function ensureClockwise(pts: readonly Vec2[]): Vec2[] {
  return signedArea(pts) < 0 ? [...pts].reverse() : [...pts];
}

/** 시계방향 다각형에서 i번째 꼭짓점이 볼록(안쪽 각 < 180°)인지 */
export function isConvexVertex(pts: readonly Vec2[], i: number): boolean {
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const cur = pts[i];
  const next = pts[(i + 1) % n];
  const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
  return cross > 0;
}
