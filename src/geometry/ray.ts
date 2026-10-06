import type { Vec2 } from '../model/types';
import { cross, sub } from './vec';

/**
 * 반직선 origin + t·dir (t ≥ 0)이 선분 a-b와 만나는 t. 만나지 않거나 평행이면 null.
 * dir이 단위벡터면 t는 거리다.
 */
export function raySegment(origin: Vec2, dir: Vec2, a: Vec2, b: Vec2): number | null {
  const e = sub(b, a);
  const denom = cross(dir, e);
  if (Math.abs(denom) < 1e-12) return null;
  const ao = sub(a, origin);
  const t = cross(ao, e) / denom;
  const u = cross(ao, dir) / denom;
  const EPS = 1e-9;
  if (t < -EPS || u < -EPS || u > 1 + EPS) return null;
  return Math.max(0, t);
}
