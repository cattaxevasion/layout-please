import { describe, expect, it } from 'vitest';
import { convexOverlap, pointInPolygon, polygonInside } from '../geometry/sat';
import { rectCorners } from '../geometry/obb';
import type { Door, Furniture, House } from '../model/types';
import { checkLayout, createCollisionChecker } from './collision';
import { solidIntervals } from './openings';
import { wallsFromRoom } from './walls';

const sq = (x: number, y: number, w: number, d: number, rotation = 0) => rectCorners({ x, y, width: w, depth: d, rotation });

describe('SAT', () => {
  it('겹침 / 떨어짐 / 딱 붙음', () => {
    expect(convexOverlap(sq(0, 0, 10, 10), sq(5, 5, 10, 10))).toBe(true);
    expect(convexOverlap(sq(0, 0, 10, 10), sq(20, 0, 10, 10))).toBe(false);
    expect(convexOverlap(sq(0, 0, 10, 10), sq(10, 0, 10, 10))).toBe(false); // 변끼리 닿음
  });

  it('회전된 사각형: AABB는 겹쳐도 실제로는 안 겹치는 경우', () => {
    // 45° 돌린 정사각형의 모서리 근처
    expect(convexOverlap(sq(0, 0, 10, 10, 45), sq(9, 9, 6, 6))).toBe(false);
    expect(convexOverlap(sq(0, 0, 10, 10, 45), sq(6, 0, 6, 6))).toBe(true);
  });
});

describe('다각형 포함', () => {
  // ㄱ자: 0~200 × 0~100 에 100~200 × 100~200 이 붙은 모양
  const L = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  it('점', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, L)).toBe(true);
    expect(pointInPolygon({ x: 50, y: 150 }, L)).toBe(false);
  });
  it('ㄱ자 안쪽 모서리를 가로지르는 사각형은 밖으로 판정', () => {
    expect(polygonInside(sq(150, 150, 40, 40), L)).toBe(true);
    // 네 꼭짓점은 모두 안이지만 오목한 모서리(100,100)가 사각형 안으로 들어오는 경우
    expect(polygonInside(rectCorners({ x: 100, y: 100, width: 60, depth: 60, rotation: 45 }), L)).toBe(false);
  });
});

describe('solidIntervals', () => {
  it('문 자리를 뺀 구간', () => {
    expect(solidIntervals(300, [{ offset: 100, width: 80 }])).toEqual([
      [0, 100],
      [180, 300],
    ]);
    expect(solidIntervals(100, [{ offset: 0, width: 100 }])).toEqual([]);
  });
});

function testHouse(doorType: Door['type'] = 'hinged'): House {
  const room = {
    id: 'r1',
    name: '방',
    floorColor: '#fff',
    points: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 0, y: 200 },
    ],
  };
  const walls = wallsFromRoom(room.points, 10, [], 'r1');
  // 위쪽 벽(a=(-10,-5) → b=(310,-5))의 x 100~180에 방 안쪽으로 열리는 문
  const door: Door = {
    id: 'd1',
    wallId: walls[0].id,
    type: doorType,
    offset: 110,
    width: 80,
    height: 200,
    hinge: 'start',
    side: -1,
    swingRadius: 80,
    swingAngle: 90,
  };
  return { ceilingHeight: 240, rooms: [room], walls, doors: [door], windows: [], fixtures: [] };
}

const f = (id: string, x: number, y: number, width = 50, depth = 50, rotation = 0): Furniture => ({
  id,
  name: id,
  shape: 'box',
  width,
  depth,
  height: 50,
  color: '#000',
  x,
  y,
  rotation,
});

describe('checkLayout', () => {
  it('문제없는 배치', () => {
    const r = checkLayout(testHouse(), [f('a', 50, 150), f('b', 250, 150)]);
    expect(r.size).toBe(0);
  });

  it('벽에 딱 붙이거나 가구끼리 맞닿은 것은 충돌이 아니다', () => {
    const r = checkLayout(testHouse(), [f('a', 25, 175), f('b', 75, 175)]);
    expect(r.size).toBe(0);
  });

  it('방 밖 + 벽 겹침', () => {
    const r = checkLayout(testHouse(), [f('a', 0, 150)]);
    expect(r.get('a')!.map((i) => i.type).sort()).toEqual(['outOfRoom', 'wall']);
  });

  it('가구끼리 겹침은 양쪽 모두에 표시', () => {
    const r = checkLayout(testHouse(), [f('a', 50, 150), f('b', 80, 150)]);
    expect(r.get('a')).toEqual([{ type: 'overlap', otherId: 'b' }]);
    expect(r.get('b')).toEqual([{ type: 'overlap', otherId: 'a' }]);
  });

  it('여닫이문 스윙 영역', () => {
    // 문은 x 100~180, 경첩은 x=100쪽, 방 안으로 80cm 열림
    expect(checkLayout(testHouse(), [f('a', 120, 30)]).get('a')).toEqual([{ type: 'doorSwing', otherId: 'd1' }]);
    // 부채꼴 바깥(경첩 반대쪽 아래 구석)은 괜찮음
    expect(checkLayout(testHouse(), [f('a', 175, 80, 10, 10)]).size).toBe(0);
  });

  it('미닫이는 문 앞 30cm만 비우면 된다', () => {
    expect(checkLayout(testHouse('sliding'), [f('a', 140, 20, 40, 20)]).get('a')?.[0].type).toBe('doorSwing');
    expect(checkLayout(testHouse('sliding'), [f('a', 140, 60, 40, 20)]).size).toBe(0);
  });

  it('문 자리(벽이 뚫린 곳)에 걸친 가구는 벽 충돌이 아니라 방 밖', () => {
    const types = checkLayout(testHouse('opening'), [f('a', 140, 0, 40, 20)]).get('a')!.map((i) => i.type);
    expect(types).toContain('outOfRoom');
    expect(types).not.toContain('wall');
  });

  it('설비와 겹침', () => {
    const h = testHouse();
    h.fixtures.push({ id: 'x1', name: '싱크대', x: 250, y: 150, width: 60, depth: 60, height: 85, rotation: 0, color: '#ccc' });
    expect(checkLayout(h, [f('a', 230, 150)]).get('a')).toEqual([{ type: 'overlap', otherId: 'x1' }]);
  });
});

describe('캐시하는 검사기', () => {
  it('움직인 가구만 다시 계산해도 결과는 처음부터 계산한 것과 같다', () => {
    const h = testHouse();
    const check = createCollisionChecker();
    let list = [f('a', 50, 150), f('b', 150, 150), f('c', 250, 150)];
    expect(check(h, list).size).toBe(0);
    // b를 a 쪽으로 옮겨 겹치게
    list = [list[0], { ...list[1], x: 80 }, list[2]];
    expect(check(h, list)).toEqual(checkLayout(h, list));
    expect(check(h, list).get('a')).toEqual([{ type: 'overlap', otherId: 'b' }]);
    // 다시 떼어 놓기
    list = [list[0], { ...list[1], x: 150 }, list[2]];
    expect(check(h, list).size).toBe(0);
  });
});

describe('러그와 올려놓기', () => {
  it('러그 위 가구, 러그끼리, 문 앞 러그는 충돌이 아니다', () => {
    // 러그는 문이 열리는 자리(y 0~80)까지 덮고, 가구는 러그 위 문 영역 밖에
    const rug = { ...f('rug', 150, 100, 120, 160), shape: 'rug' as const, height: 1 };
    const rug2 = { ...f('rug2', 160, 110, 60, 60), shape: 'rug' as const, height: 1 };
    const r = checkLayout(testHouse(), [rug, rug2, f('a', 150, 150)]);
    expect(r.size).toBe(0);
  });

  it('러그도 방 밖으로 나가면 경고', () => {
    const rug = { ...f('rug', 300, 100, 120, 100), shape: 'rug' as const, height: 1 };
    expect(checkLayout(testHouse(), [rug]).get('rug')).toEqual([{ type: 'outOfRoom' }]);
  });

  it('서랍장 위에 올린 TV는 서랍장과 겹치지 않는다', () => {
    const drawers = { ...f('drawers', 150, 170), height: 67 };
    const tv = { ...f('tv', 150, 170, 40, 15), height: 47, elevation: 67 };
    expect(checkLayout(testHouse(), [drawers, tv]).size).toBe(0);
    // 높이를 덜 올리면 겹친다
    const low = { ...tv, elevation: 30 };
    expect(checkLayout(testHouse(), [drawers, low]).get('tv')).toEqual([{ type: 'overlap', otherId: 'drawers' }]);
  });
});
