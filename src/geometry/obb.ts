// 회전된 사각형(가구, 설비). 중심 (x, y), 로컬 x 길이 width, 로컬 y 길이 depth, 시계방향 회전 rotation(도).

import type { Vec2 } from '../model/types';
import { deg2rad } from './vec';

export interface RectLike {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
}

export interface Segment {
  a: Vec2;
  b: Vec2;
}

/** 로컬 x축(가로 방향)과 로컬 y축(세로 방향, 정면 쪽)의 월드 단위벡터 */
export function rectAxes(rotation: number): [Vec2, Vec2] {
  const r = deg2rad(rotation);
  const c = round(Math.cos(r));
  const s = round(Math.sin(r));
  return [
    { x: c, y: s },
    { x: -s, y: c },
  ];
}

/** 90° 배수 회전에서 cos/sin이 1e-17 같은 값이 되어 스냅이 어긋나는 것을 막는다. */
function round(v: number) {
  return Math.abs(v) < 1e-12 ? 0 : v;
}

/** 로컬 좌표 → 월드 좌표 */
export function localToWorld(r: RectLike, lx: number, ly: number): Vec2 {
  const [ux, uy] = rectAxes(r.rotation);
  return { x: r.x + ux.x * lx + uy.x * ly, y: r.y + ux.y * lx + uy.y * ly };
}

/** 꼭짓점: 왼쪽 뒤 → 오른쪽 뒤 → 오른쪽 앞 → 왼쪽 앞 (화면상 시계방향) */
export function rectCorners(r: RectLike): Vec2[] {
  const w = r.width / 2;
  const d = r.depth / 2;
  return [localToWorld(r, -w, -d), localToWorld(r, w, -d), localToWorld(r, w, d), localToWorld(r, -w, d)];
}

export function rectSides(r: RectLike): Segment[] {
  const c = rectCorners(r);
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4] }));
}

export interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function pointsAabb(pts: readonly Vec2[]): Aabb {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export const rectAabb = (r: RectLike) => pointsAabb(rectCorners(r));
