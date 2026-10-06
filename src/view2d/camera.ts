import { pointsAabb } from '../geometry/obb';
import { wallPolygon } from '../logic/openings';
import type { House, Vec2 } from '../model/types';

export interface Camera {
  /** 화면 가운데의 월드 좌표 */
  cx: number;
  cy: number;
  /** 1cm가 몇 px인지 */
  s: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 20;
export const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function houseBounds(h: House) {
  const pts: Vec2[] = h.rooms.flatMap((r) => r.points);
  for (const w of h.walls) pts.push(...wallPolygon(w));
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 500, maxY: 500 };
  return pointsAabb(pts);
}

export function fitCamera(h: House, w: number, hgt: number): Camera {
  const b = houseBounds(h);
  const bw = Math.max(50, b.maxX - b.minX);
  const bh = Math.max(50, b.maxY - b.minY);
  const s = clampScale(Math.min(w / bw, hgt / bh) * 0.88);
  return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, s };
}
