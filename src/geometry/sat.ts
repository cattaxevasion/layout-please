// 볼록 다각형 충돌 판정 (분리축 정리, SAT)과 다각형 포함 판정.

import type { Vec2 } from '../model/types';
import { dot } from './vec';
import { segmentsCrossProperly } from './segment';

function project(poly: readonly Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = dot(p, axis);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * 두 볼록 다각형이 겹치는지. 모서리끼리 닿기만 한 경우는 겹침이 아니다.
 * eps만큼 파고들어야 겹침으로 본다.
 */
export function convexOverlap(a: readonly Vec2[], b: readonly Vec2[], eps = 1e-6): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len === 0) continue;
      const axis = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
      const [amin, amax] = project(a, axis);
      const [bmin, bmax] = project(b, axis);
      if (amax <= bmin + eps || bmax <= amin + eps) return false;
    }
  }
  return true;
}

/** 짝홀 규칙 점 포함 판정 (경계 위의 점은 어느 쪽이든 될 수 있음) */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * 볼록 다각형 inner가 (오목할 수도 있는) 다각형 outer 안에 완전히 들어 있는지.
 * 모든 꼭짓점이 안에 있고, 변끼리 서로 가로지르지 않으면 포함으로 본다.
 */
export function polygonInside(inner: readonly Vec2[], outer: readonly Vec2[]): boolean {
  if (!inner.every((p) => pointInPolygon(p, outer))) return false;
  for (let i = 0; i < inner.length; i++) {
    const p1 = inner[i];
    const p2 = inner[(i + 1) % inner.length];
    for (let j = 0; j < outer.length; j++) {
      if (segmentsCrossProperly(p1, p2, outer[j], outer[(j + 1) % outer.length])) return false;
    }
  }
  return true;
}
