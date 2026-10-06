import { ensureClockwise, isConvexVertex } from '../geometry/polygon';
import { pointSegmentDistance } from '../geometry/segment';
import { add, cross, dist, dot, lerp, normalize, scale, sub } from '../geometry/vec';
import { newId } from '../model/ids';
import type { Door, House, Id, Opening, Vec2, Wall } from '../model/types';
import { wallFrame } from './openings';

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
  roomId?: Id,
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
      ...(roomId ? { roomId } : {}),
    });
  }
  return walls;
}

export const DEFAULT_WALL_THICKNESS = 10;

const PARALLEL = 0.02;

/** 방의 변 p-q가 이미 다른 벽(t/2만큼 바깥에 놓인 중심선)으로 덮여 있는지 */
function edgeCoveredBy(p: Vec2, q: Vec2, w: Wall): boolean {
  const len = dist(p, q);
  if (len === 0) return true;
  const { u, n, length } = wallFrame(w);
  if (Math.abs(cross(normalize(sub(q, p)), u)) > PARALLEL) return false;
  const mid = lerp(p, q, 0.5);
  if (Math.abs(Math.abs(dot(sub(mid, w.a), n)) - w.thickness / 2) > 2) return false;
  const s0 = dot(sub(p, w.a), u);
  const s1 = dot(sub(q, w.a), u);
  const lo = Math.max(Math.min(s0, s1), 0);
  const hi = Math.min(Math.max(s0, s1), length);
  return hi - lo >= len * 0.5;
}

/**
 * 변 p-q가 이어받을 옛 벽: 가까운(60cm 이내) 평행한 벽이 있으면 그 벽, 없으면 방향과 상관없이 가장 가까운 벽.
 * 꼭짓점 하나를 옮기는 도중 변이 잠깐 비스듬해져도 두께와 벽지가 유지되게 한다.
 */
function inheritFrom(p: Vec2, q: Vec2, walls: readonly Wall[]): Wall | null {
  const e = normalize(sub(q, p));
  const mid = lerp(p, q, 0.5);
  let parallel: { d: number; w: Wall } | null = null;
  let any: { d: number; w: Wall } | null = null;
  for (const w of walls) {
    const d = pointSegmentDistance(mid, w.a, w.b);
    if (!any || d < any.d) any = { d, w };
    if (Math.abs(cross(e, wallFrame(w).u)) <= PARALLEL && (!parallel || d < parallel.d)) parallel = { d, w };
  }
  if (parallel && parallel.d <= 60) return parallel.w;
  return any ? any.w : null;
}

/**
 * 옛 벽에 붙어 있던 문/창을 후보 벽 중 가장 가까운 평행한 벽으로 옮긴다.
 * 개구부 중심의 위치를 유지하고, 새 벽의 방향이 반대면 경첩과 여는 쪽도 뒤집는다.
 */
export function reattachOpening<T extends Opening>(o: T, oldWall: Wall, candidates: readonly Wall[]): T | null {
  const { u } = wallFrame(oldWall);
  const center = add(oldWall.a, scale(u, o.offset + o.width / 2));
  let best: Wall | null = null;
  let bestD = Infinity;
  for (const w of candidates) {
    if (Math.abs(cross(u, wallFrame(w).u)) > 0.05) continue;
    const d = pointSegmentDistance(center, w.a, w.b);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  if (!best || bestD > 100) return null;
  const f = wallFrame(best);
  const s = dot(sub(center, best.a), f.u);
  const offset = Math.max(0, Math.min(Math.max(0, f.length - o.width), s - o.width / 2));
  const next = { ...o, wallId: best.id, offset };
  if (dot(u, f.u) < 0 && 'hinge' in next) {
    const d = next as unknown as Door;
    d.hinge = d.hinge === 'start' ? 'end' : 'start';
    d.side = d.side === 1 ? -1 : 1;
  }
  return next;
}

/**
 * 방에 딸린 벽(roomId가 같은 벽)을 지금 방 모양에 맞게 다시 만든다.
 * - 변마다 두께는 가장 가까운 옛 벽의 두께를 이어받는다.
 * - 다른 벽이 이미 덮고 있는 변(이웃 방과 공유하는 벽)은 만들지 않는다.
 * - 옛 벽의 문/창은 새 벽으로 옮겨 붙인다.
 */
export function rebuildRoomWalls(house: House, roomId: Id, fallback = DEFAULT_WALL_THICKNESS): House {
  const room = house.rooms.find((r) => r.id === roomId);
  if (!room || room.points.length < 3) return house;
  const old = house.walls.filter((w) => w.roomId === roomId);
  const others = house.walls.filter((w) => w.roomId !== roomId);
  const pts = ensureClockwise(room.points);
  const n = pts.length;
  const thickness: number[] = [];
  const finishes: (Id | undefined)[] = [];
  const skip: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const src = inheritFrom(p, q, old.length ? old : others);
    thickness.push(src ? src.thickness : fallback);
    // 벽지는 이 방의 옛 벽에서만 이어받는다 (이웃 방 벽의 포인트 벽지가 번지지 않게)
    finishes.push(old.length && src ? src.finish : undefined);
    if (others.some((w) => edgeCoveredBy(p, q, w))) skip.push(i);
  }
  const fresh = wallsFromRoom(pts, thickness, skip, roomId);
  // wallsFromRoom은 skip한 변을 빼고 순서대로 만들므로 변 번호를 맞춰 벽지를 붙인다
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    const f = finishes[i];
    if (f) fresh[k] = { ...fresh[k], finish: f };
    k++;
  }
  const walls = [...others, ...fresh];
  const oldById = new Map(old.map((w) => [w.id, w]));
  function move<T extends Opening>(list: readonly T[]): T[] {
    const out: T[] = [];
    for (const o of list) {
      const w = oldById.get(o.wallId);
      if (!w) {
        out.push(o);
        continue;
      }
      const moved = reattachOpening(o, w, walls);
      if (moved) out.push(moved);
    }
    return out;
  }
  return { ...house, walls, doors: move(house.doors), windows: move(house.windows) };
}
