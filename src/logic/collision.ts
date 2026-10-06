// 충돌 검사: 방 밖으로 나감 / 벽과 겹침 / 가구·설비끼리 겹침 / 문 영역과 겹침.
// 배치를 막지는 않고 경고만 한다.

import { pointsAabb, rectCorners, type Aabb, type RectLike } from '../geometry/obb';
import { convexOverlap, polygonInside } from '../geometry/sat';
import type { CollisionMap, Furniture, House, Issue, Vec2 } from '../model/types';
import { doorKeepOutZones, solidIntervals, wallFrame, wallPiecePolygon } from './openings';

/** 이만큼(cm)은 파고들어도 봐준다. 벽이나 다른 가구에 딱 붙인 경우를 충돌로 보지 않기 위해서. */
export const TOLERANCE = 0.5;

interface Shape {
  id: string;
  poly: Vec2[];
  box: Aabb;
}

const shape = (id: string, poly: Vec2[]): Shape => ({ id, poly, box: pointsAabb(poly) });

const boxesTouch = (a: Aabb, b: Aabb) =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/** 사방으로 TOLERANCE만큼 줄인 사각형 */
function shrunk(r: RectLike): Vec2[] {
  return rectCorners({
    ...r,
    width: Math.max(0.01, r.width - TOLERANCE * 2),
    depth: Math.max(0.01, r.depth - TOLERANCE * 2),
  });
}

/** 벽에서 문 자리를 뺀 막힌 조각들 (창은 아래쪽 벽이 있으므로 막힌 것으로 본다) */
export function solidWallShapes(house: House): Shape[] {
  const out: Shape[] = [];
  for (const w of house.walls) {
    const doors = house.doors.filter((d) => d.wallId === w.id);
    for (const [s, e] of solidIntervals(wallFrame(w).length, doors)) {
      out.push(shape(w.id, wallPiecePolygon(w, s, e)));
    }
  }
  return out;
}

export function doorZoneShapes(house: House): Shape[] {
  const walls = new Map(house.walls.map((w) => [w.id, w]));
  const out: Shape[] = [];
  for (const d of house.doors) {
    const w = walls.get(d.wallId);
    if (w) for (const z of doorKeepOutZones(w, d)) out.push(shape(d.id, z));
  }
  return out;
}

export function checkLayout(house: House, furniture: readonly Furniture[]): CollisionMap {
  const result: CollisionMap = new Map();
  const add = (id: string, issue: Issue) => {
    const list = result.get(id);
    if (list) {
      if (!list.some((x) => x.type === issue.type && x.otherId === issue.otherId)) list.push(issue);
    } else result.set(id, [issue]);
  };

  const items = furniture.map((f) => shape(f.id, shrunk(f)));
  const fixtures = house.fixtures.map((f) => shape(f.id, rectCorners(f)));
  const walls = solidWallShapes(house);
  const zones = doorZoneShapes(house);

  items.forEach((it, i) => {
    if (!house.rooms.some((r) => polygonInside(it.poly, r.points))) add(it.id, { type: 'outOfRoom' });

    for (const w of walls) {
      if (boxesTouch(it.box, w.box) && convexOverlap(it.poly, w.poly)) {
        add(it.id, { type: 'wall', otherId: w.id });
        break;
      }
    }
    for (const fx of fixtures) {
      if (boxesTouch(it.box, fx.box) && convexOverlap(it.poly, fx.poly)) add(it.id, { type: 'overlap', otherId: fx.id });
    }
    for (let j = i + 1; j < items.length; j++) {
      const other = items[j];
      if (boxesTouch(it.box, other.box) && convexOverlap(it.poly, other.poly)) {
        add(it.id, { type: 'overlap', otherId: other.id });
        add(other.id, { type: 'overlap', otherId: it.id });
      }
    }
    for (const z of zones) {
      if (boxesTouch(it.box, z.box) && convexOverlap(it.poly, z.poly)) add(it.id, { type: 'doorSwing', otherId: z.id });
    }
  });
  return result;
}

/** 경고 문구 (UI용) */
export function describeIssue(issue: Issue, nameOf: (id: string) => string | undefined): string {
  switch (issue.type) {
    case 'outOfRoom':
      return '방 밖으로 나가 있습니다';
    case 'wall':
      return '벽과 겹칩니다';
    case 'overlap':
      return `'${nameOf(issue.otherId ?? '') ?? '다른 가구'}'와(과) 겹칩니다`;
    case 'doorSwing':
      return '문이 열리는 자리(문 앞 통로)를 막습니다';
  }
}
