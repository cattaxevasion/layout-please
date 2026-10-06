// 선택한 가구의 치수 표시용: 네 변에서 바깥쪽으로 가장 가까운 벽(방 실내 면)까지의 거리.

import { localToWorld, rectAxes, type RectLike } from '../geometry/obb';
import { raySegment } from '../geometry/ray';
import { add, scale } from '../geometry/vec';
import type { House, Vec2 } from '../model/types';

export interface WallDistance {
  side: 'back' | 'right' | 'front' | 'left';
  from: Vec2;
  to: Vec2;
  distance: number;
}

/** 이보다 먼 벽은 표시하지 않는다 (방 밖에 있을 때 엉뚱한 선이 그려지는 것 방지) */
const MAX_DISTANCE = 1500;

export function distancesToWalls(rect: RectLike, house: House): WallDistance[] {
  const [ux, uy] = rectAxes(rect.rotation);
  const w = rect.width / 2;
  const d = rect.depth / 2;
  const sides: [WallDistance['side'], Vec2, Vec2][] = [
    ['back', localToWorld(rect, 0, -d), scale(uy, -1)],
    ['right', localToWorld(rect, w, 0), ux],
    ['front', localToWorld(rect, 0, d), uy],
    ['left', localToWorld(rect, -w, 0), scale(ux, -1)],
  ];
  const out: WallDistance[] = [];
  for (const [side, from, dir] of sides) {
    let best = Infinity;
    for (const r of house.rooms) {
      const pts = r.points;
      for (let i = 0; i < pts.length; i++) {
        const t = raySegment(from, dir, pts[i], pts[(i + 1) % pts.length]);
        if (t !== null && t < best) best = t;
      }
    }
    if (best <= MAX_DISTANCE) out.push({ side, from, to: add(from, scale(dir, best)), distance: best });
  }
  return out;
}

/** 표시용 cm 반올림: 정수면 그대로, 아니면 소수 첫째 자리 */
export function formatCm(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
