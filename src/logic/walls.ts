import { ensureClockwise, isConvexVertex } from '../geometry/polygon';
import { newId } from '../model/ids';
import type { Vec2, Wall } from '../model/types';

/**
 * 실내 면 기준 방 다각형에서 벽을 만든다.
 * 각 변을 바깥쪽으로 두께의 절반만큼 밀어 중심선으로 삼는다. 볼록한 모서리에서는 이웃 벽의 두께만큼
 * 늘려 바깥 모서리 사각형까지 메운다. 오목한 모서리에서 늘리면 벽이 방 안으로 파고들기 때문에 늘리지 않는다.
 *
 * 변 번호 i는 (시계방향으로 정규화한 뒤의) 꼭짓점 i → i+1 변이다.
 * @param thickness 모든 변에 같은 두께, 또는 변마다 두께 배열
 * @param skipEdges 만들지 않을 변 번호 (이웃 방과 공유하는 벽을 한 번만 만들 때)
 */
export function wallsFromRoom(
  points: readonly Vec2[],
  thickness: number | readonly number[],
  skipEdges: readonly number[] = [],
): Wall[] {
  const pts = ensureClockwise(points);
  const n = pts.length;
  const thick = (i: number) => (typeof thickness === 'number' ? thickness : thickness[(i + n) % n]);
  const walls: Wall[] = [];
  for (let i = 0; i < n; i++) {
    if (skipEdges.includes(i)) continue;
    const t = thick(i);
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len === 0) continue;
    const dx = (q.x - p.x) / len;
    const dy = (q.y - p.y) / len;
    // 시계방향 다각형에서 바깥 법선은 (dy, -dx)
    const ox = dy * (t / 2);
    const oy = -dx * (t / 2);
    const extA = isConvexVertex(pts, i) ? thick(i - 1) : 0;
    const extB = isConvexVertex(pts, (i + 1) % n) ? thick(i + 1) : 0;
    walls.push({
      id: newId('w'),
      a: { x: p.x + ox - dx * extA, y: p.y + oy - dy * extA },
      b: { x: q.x + ox + dx * extB, y: q.y + oy + dy * extB },
      thickness: t,
    });
  }
  return walls;
}
