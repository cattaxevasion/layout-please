// 벽에 붙은 문/창의 위치 계산. 2D와 3D, 충돌 검사가 함께 쓴다.

import { add, dist, leftNormal, normalize, scale, sub } from '../geometry/vec';
import type { Door, Opening, Vec2, Wall } from '../model/types';

export interface WallFrame {
  /** a→b 단위벡터 */
  u: Vec2;
  /** 화면상 왼쪽 법선 */
  n: Vec2;
  length: number;
}

export function wallFrame(w: Wall): WallFrame {
  const u = normalize(sub(w.b, w.a));
  return { u, n: leftNormal(u), length: dist(w.a, w.b) };
}

/** 벽 두께 사각형의 네 꼭짓점 */
export function wallPolygon(w: Wall): Vec2[] {
  const { n } = wallFrame(w);
  const h = scale(n, w.thickness / 2);
  return [add(w.a, h), add(w.b, h), sub(w.b, h), sub(w.a, h)];
}

/** 개구부의 중심선 위 시작점·끝점 (벽 길이를 넘지 않게 자른다) */
export function openingSpan(w: Wall, o: Pick<Opening, 'offset' | 'width'>): [Vec2, Vec2] {
  const { u, length } = wallFrame(w);
  const s = Math.max(0, Math.min(length, o.offset));
  const e = Math.max(0, Math.min(length, o.offset + o.width));
  return [add(w.a, scale(u, s)), add(w.a, scale(u, e))];
}

/** 개구부를 벽 두께만큼 덮는 사각형 */
export function openingPolygon(w: Wall, o: Pick<Opening, 'offset' | 'width'>): Vec2[] {
  const { n } = wallFrame(w);
  const [s, e] = openingSpan(w, o);
  const h = scale(n, w.thickness / 2 + 0.5);
  return [add(s, h), add(e, h), sub(e, h), sub(s, h)];
}

/**
 * 여닫이/접이문의 스윙 정보. 경첩 위치, 닫힌 방향, 열린 방향, 반경.
 * 문짝은 벽의 열리는 쪽 면에서 회전한다.
 */
export function doorSwing(w: Wall, d: Door) {
  const { n } = wallFrame(w);
  const [s, e] = openingSpan(w, d);
  const face = scale(n, (d.side * w.thickness) / 2);
  const hinge = add(d.hinge === 'start' ? s : e, face);
  const closedDir = normalize(d.hinge === 'start' ? sub(e, s) : sub(s, e));
  const openDir = scale(n, d.side);
  const radius = d.type === 'folding' ? d.width / 2 : d.swingRadius;
  return { hinge, closedDir, openDir, radius };
}
