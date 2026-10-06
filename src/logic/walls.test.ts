import { describe, expect, it } from 'vitest';
import { signedArea } from '../geometry/polygon';
import { wallsFromRoom } from './walls';

const rect = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 },
];

describe('wallsFromRoom', () => {
  it('직사각형 방: 벽이 바깥쪽에 놓이고 바깥 모서리 사각형까지 메워진다', () => {
    const [top, right] = wallsFromRoom(rect, 10);
    expect(top.a).toEqual({ x: -10, y: -5 });
    expect(top.b).toEqual({ x: 110, y: -5 });
    expect(right.a).toEqual({ x: 105, y: -10 });
    expect(right.b).toEqual({ x: 105, y: 60 });
  });

  it('두께가 다른 벽이 만나는 모서리는 이웃 벽 두께만큼 늘린다', () => {
    const [top, right] = wallsFromRoom(rect, [10, 20, 10, 20]);
    expect(top.b).toEqual({ x: 120, y: -5 });
    expect(right.a).toEqual({ x: 110, y: -10 });
  });

  it('반시계방향으로 입력해도 결과는 같은 위치', () => {
    const ccw = [...rect].reverse();
    expect(signedArea(ccw)).toBeLessThan(0);
    const walls = wallsFromRoom(ccw, 10);
    expect(walls.some((w) => w.a.y === -5 && w.b.y === -5)).toBe(true);
  });

  it('ㄱ자 방의 오목한 모서리에서는 벽을 늘리지 않는다', () => {
    const l = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 }, // 오목
      { x: 200, y: 50 },
      { x: 200, y: 150 },
      { x: 0, y: 150 },
    ];
    const walls = wallsFromRoom(l, 10);
    // 1번 변 (100,0)→(100,50): 끝점이 오목하므로 y=50에서 멈춘다
    expect(walls[1].b).toEqual({ x: 105, y: 50 });
    // 2번 변 (100,50)→(200,50): 시작점이 오목하므로 x=100에서 시작
    expect(walls[2].a).toEqual({ x: 100, y: 45 });
  });

  it('skipEdges', () => {
    expect(wallsFromRoom(rect, 10, [0, 2])).toHaveLength(2);
  });
});
