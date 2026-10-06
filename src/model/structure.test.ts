import { describe, expect, it } from 'vitest';
import { openingSpan } from '../logic/openings';
import { createSampleHouse } from './sample';
import * as st from './structure';
import type { House } from './types';

const ldk = (h: House) => h.rooms.find((r) => r.name === 'LDK')!;
const owned = (h: House, roomId: string) => h.walls.filter((w) => w.roomId === roomId);

describe('방 꼭짓점 편집과 벽 자동 재생성', () => {
  it('꼭짓점을 옮기면 그 방의 벽이 따라오고 두께가 유지된다', () => {
    const h = createSampleHouse();
    const room = ldk(h);
    // 오른쪽 벽(꼭짓점 3, 4)을 오른쪽으로 20 이동
    const before = owned(h, room.id);
    const pts = room.points.map((p, i) => (i === 3 || i === 4 ? { x: p.x + 20, y: p.y } : p));
    const h2 = st.setRoomPoints(h, room.id, pts);
    const after = owned(h2, room.id);
    expect(after).toHaveLength(before.length);
    expect(after.map((w) => w.thickness).sort()).toEqual(before.map((w) => w.thickness).sort());
    const right = after.find((w) => w.thickness === 15 && w.a.x === w.b.x && w.a.x > 300)!;
    expect(right.a.x).toBe(372 + 20 + 7.5);
    // 다른 방 벽은 그대로
    const bedId = h.rooms[1].id;
    expect(owned(h2, bedId)).toEqual(owned(h, bedId));
  });

  it('꼭짓점을 하나씩 옮겨 변이 잠깐 비스듬해져도 두께가 유지된다', () => {
    let h = createSampleHouse();
    const room = ldk(h);
    h = st.moveVertex(h, room.id, 3, { x: 392, y: 68 }); // 오른쪽 벽이 잠깐 비스듬
    h = st.moveVertex(h, room.id, 4, { x: 392, y: 359 });
    const right = owned(h, room.id).find((w) => Math.abs(w.a.x - w.b.x) < 1e-9 && w.a.x > 390)!;
    expect(right.thickness).toBe(15);
  });

  it('문과 창은 같은 자리의 새 벽으로 옮겨 붙는다', () => {
    const h = createSampleHouse();
    const room = ldk(h);
    const wallsById = (x: House) => new Map(x.walls.map((w) => [w.id, w]));
    const centers = (x: House) => {
      const m = wallsById(x);
      return x.doors.map((d) => {
        const [s, e] = openingSpan(m.get(d.wallId)!, d);
        return { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
      });
    };
    // 왼쪽 위 꼭짓점을 아주 조금 옮겨 모든 LDK 벽을 다시 만든다
    const h2 = st.moveVertex(h, room.id, 0, { x: 0, y: 0.5 });
    expect(h2.doors).toHaveLength(h.doors.length);
    const m2 = wallsById(h2);
    for (const d of h2.doors) expect(m2.has(d.wallId)).toBe(true);
    centers(h2).forEach((c, i) => {
      expect(c.x).toBeCloseTo(centers(h)[i].x, 0);
      expect(Math.abs(c.y - centers(h)[i].y)).toBeLessThan(1);
    });
  });

  it('이웃 방과 공유하는 변은 벽을 두 번 만들지 않는다', () => {
    const h = createSampleHouse();
    const bed = h.rooms[1];
    const h2 = st.moveVertex(h, bed.id, 2, { x: 372, y: 610 }); // 양실 오른쪽 아래를 3cm 내림
    // 양실 위쪽 변(LDK 벽이 덮음)은 여전히 생략 → 양실 벽 5개
    expect(owned(h2, bed.id)).toHaveLength(5);
  });

  it('꼭짓점 추가/삭제 (최소 3개)', () => {
    let h = createSampleHouse();
    const id = h.rooms[1].id;
    const r = st.insertVertex(h, id, 0);
    expect(r.index).toBe(1);
    expect(r.house.rooms[1].points).toHaveLength(7);
    expect(r.house.rooms[1].points[1]).toEqual({ x: (161 + 372) / 2, y: 371 });
    h = st.addRectRoom(h, { x: 0, y: 0 }).house;
    const tri = h.rooms[2];
    h = st.removeVertex(h, tri.id, 0);
    expect(h.rooms[2].points).toHaveLength(3);
    expect(st.removeVertex(h, tri.id, 0)).toBe(h);
  });

  it('새 직사각형 방은 벽 4개를 함께 만든다', () => {
    const { house, id } = st.addRectRoom(createSampleHouse(), { x: 1000, y: 1000 });
    expect(owned(house, id)).toHaveLength(4);
  });

  it('방을 지우면 그 방 벽과 벽 위 문/창도 지운다', () => {
    const h = createSampleHouse();
    const room = ldk(h);
    const h2 = st.removeRoom(h, room.id);
    expect(owned(h2, room.id)).toHaveLength(0);
    const wallIds = new Set(h2.walls.map((w) => w.id));
    expect(h2.doors.every((d) => wallIds.has(d.wallId))).toBe(true);
    expect(h2.windows.every((d) => wallIds.has(d.wallId))).toBe(true);
  });
});

describe('벽', () => {
  it('끝점을 직접 옮기면 방 소속에서 분리', () => {
    const h = createSampleHouse();
    const w = h.walls[0];
    expect(w.roomId).toBeDefined();
    const h2 = st.updateWall(h, w.id, { a: { x: w.a.x - 5, y: w.a.y } });
    expect(h2.walls[0].roomId).toBeUndefined();
    // 두께만 바꾸면 소속 유지
    expect(st.updateWall(h, w.id, { thickness: 20 }).walls[0].roomId).toBe(w.roomId);
  });

  it('길이 변경은 시작점 고정', () => {
    const { house, id } = st.addWall(createSampleHouse(), { x: 0, y: 0 }, { x: 100, y: 0 });
    const w = st.setWallLength(house, id, 250).walls.find((x) => x.id === id)!;
    expect(w.a).toEqual({ x: 0, y: 0 });
    expect(w.b.x).toBeCloseTo(250);
  });

  it('벽을 지우면 그 벽의 문/창도 지운다', () => {
    const h = createSampleHouse();
    const d = h.doors[0];
    const h2 = st.removeWall(h, d.wallId);
    expect(h2.doors.some((x) => x.id === d.id)).toBe(false);
  });

  it('문/창은 벽 가운데에 추가된다', () => {
    const { house, id } = st.addWall(createSampleHouse(), { x: 0, y: 0 }, { x: 300, y: 0 });
    const r = st.addDoor(house, id);
    expect(r.house.doors.find((d) => d.id === r.id)).toMatchObject({ offset: 110, width: 80 });
    const r2 = st.addWindow(house, id);
    expect(r2.house.windows.find((d) => d.id === r2.id)).toMatchObject({ offset: 90, width: 120 });
  });
});
