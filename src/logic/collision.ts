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

/**
 * 결과를 재사용하는 충돌 검사기. 가구 객체는 바뀔 때마다 새로 만들어지므로(불변),
 * 같은 객체끼리의 판정은 캐시해 두고 드래그 중에는 움직인 가구와 관련된 것만 다시 계산한다.
 */
export function createCollisionChecker() {
  let houseRef: House | null = null;
  let walls: Shape[] = [];
  let zones: Shape[] = [];
  let fixtures: Shape[] = [];
  let shapes = new WeakMap<Furniture, Shape>();
  /** 집 구조에 대한 판정 (방 밖, 벽, 설비, 문) */
  let staticIssues = new WeakMap<Furniture, Issue[]>();
  /** 가구 쌍 겹침 */
  let pairs = new WeakMap<Furniture, WeakMap<Furniture, boolean>>();

  const shapeOf = (f: Furniture) => {
    let s = shapes.get(f);
    if (!s) {
      s = shape(f.id, shrunk(f));
      shapes.set(f, s);
    }
    return s;
  };

  function houseIssues(f: Furniture, house: House): Issue[] {
    const cached = staticIssues.get(f);
    if (cached) return cached;
    const it = shapeOf(f);
    const out: Issue[] = [];
    if (!house.rooms.some((r) => polygonInside(it.poly, r.points))) out.push({ type: 'outOfRoom' });
    for (const w of walls) {
      if (boxesTouch(it.box, w.box) && convexOverlap(it.poly, w.poly)) {
        out.push({ type: 'wall', otherId: w.id });
        break;
      }
    }
    for (const fx of fixtures) {
      if (boxesTouch(it.box, fx.box) && convexOverlap(it.poly, fx.poly)) out.push({ type: 'overlap', otherId: fx.id });
    }
    const doors = new Set<string>();
    for (const z of zones) {
      if (!doors.has(z.id) && boxesTouch(it.box, z.box) && convexOverlap(it.poly, z.poly)) {
        doors.add(z.id);
        out.push({ type: 'doorSwing', otherId: z.id });
      }
    }
    staticIssues.set(f, out);
    return out;
  }

  function overlaps(a: Furniture, b: Furniture): boolean {
    let m = pairs.get(a);
    const hit = m?.get(b);
    if (hit !== undefined) return hit;
    const sa = shapeOf(a);
    const sb = shapeOf(b);
    const v = boxesTouch(sa.box, sb.box) && convexOverlap(sa.poly, sb.poly);
    if (!m) {
      m = new WeakMap();
      pairs.set(a, m);
    }
    m.set(b, v);
    return v;
  }

  return function check(house: House, furniture: readonly Furniture[]): CollisionMap {
    if (house !== houseRef) {
      houseRef = house;
      walls = solidWallShapes(house);
      zones = doorZoneShapes(house);
      fixtures = house.fixtures.map((f) => shape(f.id, rectCorners(f)));
      staticIssues = new WeakMap();
      shapes = new WeakMap();
      pairs = new WeakMap();
    }
    const result: CollisionMap = new Map();
    const add = (id: string, issue: Issue) => {
      const list = result.get(id);
      if (list) list.push(issue);
      else result.set(id, [issue]);
    };
    furniture.forEach((f, i) => {
      for (const issue of houseIssues(f, house)) add(f.id, issue);
      for (let j = i + 1; j < furniture.length; j++) {
        const g = furniture[j];
        if (overlaps(f, g)) {
          add(f.id, { type: 'overlap', otherId: g.id });
          add(g.id, { type: 'overlap', otherId: f.id });
        }
      }
    });
    return result;
  };
}

/** 한 번만 검사할 때 (캐시 없이) */
export function checkLayout(house: House, furniture: readonly Furniture[]): CollisionMap {
  return createCollisionChecker()(house, furniture);
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
