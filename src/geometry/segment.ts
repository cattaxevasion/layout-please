import type { Vec2 } from '../model/types';
import { cross, dot, sub } from './vec';

/** 점 p를 선분 a-b에 투영한 매개변수 t (0~1로 자르지 않음) */
export function projectT(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  return l2 === 0 ? 0 : dot(sub(p, a), ab) / l2;
}

export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const t = Math.max(0, Math.min(1, projectT(p, a, b)));
  return Math.hypot(p.x - (a.x + (b.x - a.x) * t), p.y - (a.y + (b.y - a.y) * t));
}

/**
 * 두 선분이 서로의 내부에서 교차하는지 (끝점끼리 닿기만 하는 경우와 겹쳐 놓인 평행 선분은 제외).
 * 가구가 방 안에 들어 있는지 판정할 때, 벽에 딱 붙은 가구를 교차로 보지 않기 위해서다.
 */
export function segmentsCrossProperly(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2, eps = 1e-6): boolean {
  const d1 = cross(sub(p2, p1), sub(q1, p1));
  const d2 = cross(sub(p2, p1), sub(q2, p1));
  const d3 = cross(sub(q2, q1), sub(p1, q1));
  const d4 = cross(sub(q2, q1), sub(p2, q1));
  const s = (v: number) => (v > eps ? 1 : v < -eps ? -1 : 0);
  return s(d1) * s(d2) < 0 && s(d3) * s(d4) < 0;
}
