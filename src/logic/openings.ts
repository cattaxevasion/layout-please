// 벽에 붙은 문/창의 위치 계산. 2D와 3D, 충돌 검사가 함께 쓴다.

import { add, dist, leftNormal, normalize, scale, sub } from '../geometry/vec';
import type { Door, Opening, Vec2, Wall } from '../model/types';

export interface WallFrame {
  /** a→b 단위벡터 */
  u: Vec2;
  /** 화면상 왼쪽 법선 */
  n: Vec2;
  length: number;
}

export function wallFrame(w: Wall): WallFrame {
  const u = normalize(sub(w.b, w.a));
  return { u, n: leftNormal(u), length: dist(w.a, w.b) };
}

/** 벽 두께 사각형의 네 꼭짓점 */
export function wallPolygon(w: Wall): Vec2[] {
  const { n } = wallFrame(w);
  const h = scale(n, w.thickness / 2);
  return [add(w.a, h), add(w.b, h), sub(w.b, h), sub(w.a, h)];
}

/** 개구부의 중심선 위 시작점·끝점 (벽 길이를 넘지 않게 자른다) */
export function openingSpan(w: Wall, o: Pick<Opening, 'offset' | 'width'>): [Vec2, Vec2] {
  const { u, length } = wallFrame(w);
  const s = Math.max(0, Math.min(length, o.offset));
  const e = Math.max(0, Math.min(length, o.offset + o.width));
  return [add(w.a, scale(u, s)), add(w.a, scale(u, e))];
}

/** 개구부를 벽 두께만큼 덮는 사각형 */
export function openingPolygon(w: Wall, o: Pick<Opening, 'offset' | 'width'>): Vec2[] {
  const { n } = wallFrame(w);
  const [s, e] = openingSpan(w, o);
  const h = scale(n, w.thickness / 2 + 0.5);
  return [add(s, h), add(e, h), sub(e, h), sub(s, h)];
}

/**
 * 여닫이/접이문의 스윙 정보. 경첩 위치, 닫힌 방향, 열린 방향, 반경.
 * 문짝은 벽의 열리는 쪽 면에서 회전한다.
 */
export function doorSwing(w: Wall, d: Door) {
  const { n } = wallFrame(w);
  const [s, e] = openingSpan(w, d);
  const face = scale(n, (d.side * w.thickness) / 2);
  const hinge = add(d.hinge === 'start' ? s : e, face);
  const closedDir = normalize(d.hinge === 'start' ? sub(e, s) : sub(s, e));
  const openDir = scale(n, d.side);
  const radius = d.type === 'folding' ? d.width / 2 : d.swingRadius;
  return { hinge, closedDir, openDir, radius };
}

/**
 * 벽 길이 [0, length]에서 개구부 구간을 뺀 나머지(막힌 부분) 구간들.
 * 3D 벽 만들기와 충돌 검사에서 문 자리를 비우는 데 쓴다.
 */
export function solidIntervals(length: number, openings: readonly Pick<Opening, 'offset' | 'width'>[]): [number, number][] {
  const cuts = openings
    .map((o) => [Math.max(0, o.offset), Math.min(length, o.offset + o.width)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = 0;
  for (const [s, e] of cuts) {
    if (s > cur) out.push([cur, s]);
    cur = Math.max(cur, e);
  }
  if (cur < length) out.push([cur, length]);
  return out;
}

/** 벽의 [s, e] 구간을 두께만큼 덮는 사각형 */
export function wallPiecePolygon(w: Wall, s: number, e: number): Vec2[] {
  const { u, n } = wallFrame(w);
  const h = scale(n, w.thickness / 2);
  const a = add(w.a, scale(u, s));
  const b = add(w.a, scale(u, e));
  return [add(a, h), add(b, h), sub(b, h), sub(a, h)];
}

/** 문 앞을 비워 둬야 하는 영역 (미닫이/개구부: 양쪽으로 이만큼) */
export const DOOR_CLEARANCE = 30;

/**
 * 문 때문에 가구를 두면 안 되는 영역 (볼록 다각형 목록).
 * 여닫이/접이문은 문짝이 지나가는 부채꼴, 미닫이/개구부는 문 앞뒤로 DOOR_CLEARANCE 깊이의 통로.
 */
export function doorKeepOutZones(w: Wall, d: Door): Vec2[][] {
  if (d.type === 'hinged' || d.type === 'folding') {
    const { hinge, closedDir, openDir, radius } = doorSwing(w, d);
    const a0 = Math.atan2(closedDir.y, closedDir.x);
    let delta = Math.atan2(openDir.y, openDir.x) - a0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const steps = 8;
    const pts: Vec2[] = [hinge];
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (delta * i) / steps;
      pts.push({ x: hinge.x + Math.cos(a) * radius, y: hinge.y + Math.sin(a) * radius });
    }
    return [pts];
  }
  const { n } = wallFrame(w);
  const [s, e] = openingSpan(w, d);
  return [1, -1].map((side) => {
    const f0 = scale(n, (side * w.thickness) / 2);
    const f1 = scale(n, side * (w.thickness / 2 + DOOR_CLEARANCE));
    return [add(s, f0), add(e, f0), add(e, f1), add(s, f1)];
  });
}
