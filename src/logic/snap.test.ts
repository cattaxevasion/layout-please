import { describe, expect, it } from 'vitest';
import { snapRect, snapToGrid, type SnapOptions } from './snap';

// 0~300 × 0~200 방의 실내 면
const room = [
  { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } },
  { a: { x: 300, y: 0 }, b: { x: 300, y: 200 } },
  { a: { x: 300, y: 200 }, b: { x: 0, y: 200 } },
  { a: { x: 0, y: 200 }, b: { x: 0, y: 0 } },
];

const opts = (o: Partial<SnapOptions> = {}): SnapOptions => ({
  grid: false,
  gridSize: 10,
  threshold: 8,
  targets: room,
  ...o,
});

const rect = (x: number, y: number, rotation = 0) => ({ x, y, width: 100, depth: 50, rotation });

describe('snapToGrid', () => {
  it('가장 가까운 격자로', () => {
    expect(snapToGrid(13, 5)).toBe(15);
    expect(snapToGrid(12.4, 5)).toBe(10);
    expect(snapToGrid(7, 0)).toBe(7);
  });
});

describe('snapRect', () => {
  it('벽 가까이 오면 벽에 붙는다 (왼쪽 벽, 위쪽 벽 동시에)', () => {
    // 왼쪽 변 x=3, 위쪽 변 y=5 → 둘 다 0으로
    const r = snapRect(rect(53, 30), opts());
    expect(r.x).toBe(50);
    expect(r.y).toBe(25);
    expect(r.guides).toHaveLength(2);
  });

  it('임계값보다 멀면 붙지 않는다', () => {
    const r = snapRect(rect(70, 100), opts());
    expect(r).toEqual({ x: 70, y: 100, guides: [] });
  });

  it('90° 회전한 가구는 세로 방향 길이로 판단', () => {
    // 회전 후 가로 50, 세로 100 → 오른쪽 변 x = 272 + 25 = 297 → 300에 붙음
    const r = snapRect(rect(272, 100, 90), opts());
    expect(r.x).toBeCloseTo(275);
    expect(r.y).toBeCloseTo(100);
  });

  it('비스듬한 가구는 직각 벽에 붙지 않는다', () => {
    const r = snapRect(rect(53, 100, 30), opts());
    expect(r.guides).toHaveLength(0);
  });

  it('그리드 후 벽 스냅이 그리드를 덮어쓴다', () => {
    // 그리드 10: (57, 103) → (60, 100). 왼쪽 변 10 → 벽까지 10이라 안 붙음
    expect(snapRect(rect(57, 103), opts({ grid: true }))).toMatchObject({ x: 60, y: 100 });
    // (54, 103) → 그리드 (50, 100) → 왼쪽 변 0 → 벽 스냅(delta 0)
    expect(snapRect(rect(54, 103), opts({ grid: true }))).toMatchObject({ x: 50, y: 100 });
  });

  it('다른 가구 옆면에 붙는다 (겹치는 범위가 있을 때만)', () => {
    const other = [
      { a: { x: 150, y: 50 }, b: { x: 150, y: 150 } }, // 세로 변 x=150, y 50~150
    ];
    // 오른쪽 변 x = 95 + 50 = 145 → 150으로
    expect(snapRect(rect(95, 100), opts({ targets: other })).x).toBe(100);
    // y가 멀리 떨어져 있으면(가구 y 275~325) 붙지 않음
    expect(snapRect(rect(95, 300), opts({ targets: other })).x).toBe(95);
  });
});
