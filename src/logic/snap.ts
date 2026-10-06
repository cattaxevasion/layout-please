// 가구 드래그 스냅: 그리드 → 벽/가구 면 순으로 적용한다.
// 벽·가구 스냅은 가구의 두 로컬 축 방향마다 따로 찾아서, 가장 가까운 평행한 면에 가구 변을 붙인다.

import { rectAxes, rectSides, type RectLike, type Segment } from '../geometry/obb';
import { add, dot, normalize, scale, sub } from '../geometry/vec';
import type { Furniture, House, Id, Vec2 } from '../model/types';

export interface SnapOptions {
  grid: boolean;
  gridSize: number;
  threshold: number;
  targets: readonly Segment[];
}

export interface SnapResult {
  x: number;
  y: number;
  /** 붙은 대상 면 (화면에 안내선으로 표시) */
  guides: Segment[];
}

/** 평행 판정 허용치 (약 1°) */
const PARALLEL_EPS = 0.0175;

export function snapToGrid(v: number, size: number): number {
  return size > 0 ? Math.round(v / size) * size : v;
}

export function snapRect(rect: RectLike, opts: SnapOptions): SnapResult {
  let p: Vec2 = { x: rect.x, y: rect.y };
  if (opts.grid) p = { x: snapToGrid(p.x, opts.gridSize), y: snapToGrid(p.y, opts.gridSize) };

  const guides: Segment[] = [];
  const [ax, ay] = rectAxes(rect.rotation);
  const axes: [Vec2, Vec2, number, number][] = [
    // [법선, 법선과 수직인 축, 법선 방향 반길이, 수직 방향 반길이]
    [ax, ay, rect.width / 2, rect.depth / 2],
    [ay, ax, rect.depth / 2, rect.width / 2],
  ];

  for (const [n, u, half, otherHalf] of axes) {
    const c = dot(p, n);
    const cu = dot(p, u);
    let best: { delta: number; target: Segment } | null = null;
    for (const t of opts.targets) {
      const dir = normalize(sub(t.b, t.a));
      if (Math.abs(dot(dir, n)) > PARALLEL_EPS) continue;
      // 법선 방향으로 겹치는 범위가 있어야(또는 아주 가까워야) 붙인다
      const ta = dot(t.a, u);
      const tb = dot(t.b, u);
      const gap = Math.max(Math.min(ta, tb) - (cu + otherHalf), cu - otherHalf - Math.max(ta, tb));
      if (gap > opts.threshold) continue;
      const line = dot(t.a, n);
      for (const edge of [c - half, c + half]) {
        const delta = line - edge;
        if (Math.abs(delta) <= opts.threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, target: t };
        }
      }
    }
    if (best) {
      p = add(p, scale(n, best.delta));
      guides.push(best.target);
    }
  }
  return { x: p.x, y: p.y, guides };
}

/** 스냅 대상 면: 방 실내 면, 다른 가구와 설비의 변 */
export function snapTargets(
  house: House,
  furniture: readonly Furniture[],
  excludeId: Id | null,
  opts: { walls: boolean; furniture: boolean },
): Segment[] {
  const out: Segment[] = [];
  if (opts.walls) {
    for (const r of house.rooms) {
      r.points.forEach((a, i) => out.push({ a, b: r.points[(i + 1) % r.points.length] }));
    }
  }
  if (opts.furniture) {
    for (const f of house.fixtures) out.push(...rectSides(f));
    for (const f of furniture) if (f.id !== excludeId) out.push(...rectSides(f));
  }
  return out;
}
