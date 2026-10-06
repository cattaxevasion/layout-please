import { describe, expect, it } from 'vitest';
import type { House } from '../model/types';
import { distancesToWalls, formatCm } from './measure';

const house: House = {
  ceilingHeight: 240,
  rooms: [
    {
      id: 'r',
      name: '방',
      floorColor: '#fff',
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 200 },
        { x: 0, y: 200 },
      ],
    },
  ],
  walls: [],
  doors: [],
  windows: [],
  fixtures: [],
};

describe('distancesToWalls', () => {
  it('네 변에서 벽까지의 거리', () => {
    const d = distancesToWalls({ x: 100, y: 60, width: 100, depth: 40, rotation: 0 }, house);
    const by = Object.fromEntries(d.map((x) => [x.side, x.distance]));
    expect(by).toEqual({ back: 40, right: 150, front: 120, left: 50 });
  });

  it('회전하면 로컬 방향 기준', () => {
    // 90° 회전: 정면(front)이 왼쪽(-x)을 향함
    const d = distancesToWalls({ x: 100, y: 100, width: 100, depth: 40, rotation: 90 }, house);
    const front = d.find((x) => x.side === 'front')!;
    expect(front.distance).toBeCloseTo(80);
  });
});

describe('formatCm', () => {
  it.each([
    [12, '12'],
    [12.34, '12.3'],
    [12.96, '13'],
  ])('%d → %s', (v, s) => expect(formatCm(v)).toBe(s));
});
