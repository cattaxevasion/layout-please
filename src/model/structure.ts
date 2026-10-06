// 집 구조(House)를 다루는 순수 함수. 방 모양이 바뀌면 그 방의 벽을 자동으로 다시 만든다.

import { lerp } from '../geometry/vec';
import { DEFAULT_WALL_THICKNESS, rebuildRoomWalls, wallsFromRoom } from '../logic/walls';
import { wallFrame } from '../logic/openings';
import { newId } from './ids';
import { normalizeAngle } from './ops';
import type { Door, Fixture, House, HouseWindow, Id, Room, Vec2, Wall } from './types';

function updateIn<T extends { id: Id }>(list: readonly T[], id: Id, fn: (x: T) => T): T[] | null {
  let changed = false;
  const next = list.map((x) => {
    if (x.id !== id) return x;
    const y = fn(x);
    if (y !== x) changed = true;
    return y;
  });
  return changed ? next : null;
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  return (Object.keys(b) as (keyof T)[]).every((k) => a[k] === b[k]);
}

function patchIn<T extends { id: Id }>(list: readonly T[], id: Id, patch: Partial<T>): T[] | null {
  return updateIn(list, id, (x) => {
    const y = { ...x, ...patch };
    return shallowEqual(x, y) ? x : y;
  });
}

export function setWallFinish(h: House, wallFinish: Id | undefined): House {
  if (h.wallFinish === wallFinish) return h;
  const next = { ...h };
  if (wallFinish) next.wallFinish = wallFinish;
  else delete next.wallFinish;
  return next;
}

export function setCeilingHeight(h: House, v: number): House {
  const ceilingHeight = Math.max(100, v);
  return ceilingHeight === h.ceilingHeight ? h : { ...h, ceilingHeight };
}

// ───────── 방 ─────────

export function updateRoom(
  h: House,
  id: Id,
  patch: Partial<Pick<Room, 'name' | 'floorColor' | 'floorFinish'>>,
): House {
  const rooms = patchIn<Room>(h.rooms, id, patch);
  return rooms ? { ...h, rooms } : h;
}

export function setRoomPoints(h: House, id: Id, points: Vec2[]): House {
  if (points.length < 3) return h;
  const rooms = updateIn(h.rooms, id, (r) => ({ ...r, points }));
  return rooms ? rebuildRoomWalls({ ...h, rooms }, id) : h;
}

export function moveVertex(h: House, id: Id, index: number, p: Vec2): House {
  const room = h.rooms.find((r) => r.id === id);
  if (!room || !room.points[index]) return h;
  const cur = room.points[index];
  if (cur.x === p.x && cur.y === p.y) return h;
  return setRoomPoints(h, id, room.points.map((q, i) => (i === index ? p : q)));
}

/** edgeIndex번 변(꼭짓점 edgeIndex → edgeIndex+1)의 가운데에 꼭짓점을 넣는다. 새 꼭짓점 번호를 돌려준다. */
export function insertVertex(h: House, id: Id, edgeIndex: number): { house: House; index: number } {
  const room = h.rooms.find((r) => r.id === id);
  if (!room) return { house: h, index: -1 };
  const n = room.points.length;
  const a = room.points[edgeIndex % n];
  const b = room.points[(edgeIndex + 1) % n];
  const mid = lerp(a, b, 0.5);
  const p = { x: Math.round(mid.x * 10) / 10, y: Math.round(mid.y * 10) / 10 };
  const points = [...room.points.slice(0, edgeIndex + 1), p, ...room.points.slice(edgeIndex + 1)];
  return { house: setRoomPoints(h, id, points), index: edgeIndex + 1 };
}

export function removeVertex(h: House, id: Id, index: number): House {
  const room = h.rooms.find((r) => r.id === id);
  if (!room || room.points.length <= 3) return h;
  return setRoomPoints(h, id, room.points.filter((_, i) => i !== index));
}

export function addRectRoom(
  h: House,
  center: Vec2,
  width = 300,
  depth = 250,
  name = '새 방',
): { house: House; id: Id } {
  const x0 = Math.round(center.x - width / 2);
  const y0 = Math.round(center.y - depth / 2);
  const room: Room = {
    id: newId('r'),
    name,
    floorColor: '#ece3d3',
    points: [
      { x: x0, y: y0 },
      { x: x0 + width, y: y0 },
      { x: x0 + width, y: y0 + depth },
      { x: x0, y: y0 + depth },
    ],
  };
  const house = { ...h, rooms: [...h.rooms, room] };
  return { house: rebuildRoomWalls(house, room.id), id: room.id };
}

/** 방과 그 방에 딸린 벽, 그 벽의 문/창을 함께 지운다. */
export function removeRoom(h: House, id: Id): House {
  if (!h.rooms.some((r) => r.id === id)) return h;
  const removedWalls = new Set(h.walls.filter((w) => w.roomId === id).map((w) => w.id));
  return {
    ...h,
    rooms: h.rooms.filter((r) => r.id !== id),
    walls: h.walls.filter((w) => !removedWalls.has(w.id)),
    doors: h.doors.filter((d) => !removedWalls.has(d.wallId)),
    windows: h.windows.filter((d) => !removedWalls.has(d.wallId)),
  };
}

// ───────── 벽 ─────────

export function addWall(h: House, a: Vec2, b: Vec2, thickness = DEFAULT_WALL_THICKNESS): { house: House; id: Id } {
  const wall: Wall = { id: newId('w'), a, b, thickness };
  return { house: { ...h, walls: [...h.walls, wall] }, id: wall.id };
}

/**
 * 벽 수정. 끝점을 직접 옮기면 방 자동 생성 벽에서 분리한다
 * (그대로 두면 방을 고칠 때 손으로 고친 벽이 덮어써지므로).
 */
export function updateWall(h: House, id: Id, patch: Partial<Pick<Wall, 'a' | 'b' | 'thickness' | 'finish'>>): House {
  const walls = updateIn(h.walls, id, (w) => {
    const next: Wall = { ...w, ...patch, thickness: Math.max(1, patch.thickness ?? w.thickness) };
    if (shallowEqual(w, next)) return w;
    if ((patch.a || patch.b) && next.roomId) delete next.roomId;
    return next;
  });
  return walls ? { ...h, walls } : h;
}

/** 벽 길이를 바꾼다 (시작점은 고정, 끝점을 방향 그대로 이동) */
export function setWallLength(h: House, id: Id, length: number): House {
  const w = h.walls.find((x) => x.id === id);
  if (!w || length <= 0) return h;
  const { u } = wallFrame(w);
  return updateWall(h, id, { b: { x: w.a.x + u.x * length, y: w.a.y + u.y * length } });
}

export function removeWall(h: House, id: Id): House {
  if (!h.walls.some((w) => w.id === id)) return h;
  return {
    ...h,
    walls: h.walls.filter((w) => w.id !== id),
    doors: h.doors.filter((d) => d.wallId !== id),
    windows: h.windows.filter((d) => d.wallId !== id),
  };
}

/** 선택한 방 둘레에 벽을 (다시) 만든다. 기본 두께로 처음 만들 때도 쓴다. */
export function regenerateRoomWalls(h: House, id: Id, thickness = DEFAULT_WALL_THICKNESS): House {
  const room = h.rooms.find((r) => r.id === id);
  if (!room) return h;
  if (h.walls.some((w) => w.roomId === id)) return rebuildRoomWalls(h, id, thickness);
  return { ...h, walls: [...h.walls, ...wallsFromRoom(room.points, thickness, [], id)] };
}

// ───────── 문 / 창 ─────────

function centeredOffset(h: House, wallId: Id, width: number) {
  const w = h.walls.find((x) => x.id === wallId);
  if (!w) return null;
  const len = wallFrame(w).length;
  return { offset: Math.max(0, Math.round((len - width) / 2)), width: Math.min(width, len) };
}

export function addDoor(h: House, wallId: Id): { house: House; id: Id | null } {
  const pos = centeredOffset(h, wallId, 80);
  if (!pos) return { house: h, id: null };
  const door: Door = {
    id: newId('d'),
    wallId,
    ...pos,
    type: 'hinged',
    height: 200,
    hinge: 'start',
    side: -1,
    swingRadius: pos.width,
    swingAngle: 90,
  };
  return { house: { ...h, doors: [...h.doors, door] }, id: door.id };
}

export function addWindow(h: House, wallId: Id): { house: House; id: Id | null } {
  const pos = centeredOffset(h, wallId, 120);
  if (!pos) return { house: h, id: null };
  const win: HouseWindow = { id: newId('n'), wallId, ...pos, sillHeight: 90, height: 110 };
  return { house: { ...h, windows: [...h.windows, win] }, id: win.id };
}

export function updateDoor(h: House, id: Id, patch: Partial<Omit<Door, 'id'>>): House {
  const doors = patchIn<Door>(h.doors, id, patch);
  return doors ? { ...h, doors } : h;
}

export function updateWindow(h: House, id: Id, patch: Partial<Omit<HouseWindow, 'id'>>): House {
  const windows = patchIn<HouseWindow>(h.windows, id, patch);
  return windows ? { ...h, windows } : h;
}

export function removeDoor(h: House, id: Id): House {
  const doors = h.doors.filter((d) => d.id !== id);
  return doors.length === h.doors.length ? h : { ...h, doors };
}

export function removeWindow(h: House, id: Id): House {
  const windows = h.windows.filter((d) => d.id !== id);
  return windows.length === h.windows.length ? h : { ...h, windows };
}

// ───────── 붙박이 설비 ─────────

export function addFixture(h: House, at: Vec2): { house: House; id: Id } {
  const f: Fixture = {
    id: newId('x'),
    name: '붙박이 설비',
    x: Math.round(at.x),
    y: Math.round(at.y),
    width: 60,
    depth: 60,
    height: 90,
    rotation: 0,
    color: '#d9d9d9',
  };
  return { house: { ...h, fixtures: [...h.fixtures, f] }, id: f.id };
}

export function updateFixture(h: House, id: Id, patch: Partial<Omit<Fixture, 'id'>>): House {
  const fixed: Partial<Fixture> = { ...patch };
  if (fixed.rotation !== undefined) fixed.rotation = normalizeAngle(fixed.rotation);
  for (const k of ['width', 'depth', 'height'] as const) {
    if (fixed[k] !== undefined) fixed[k] = Math.max(1, fixed[k]!);
  }
  const fixtures = patchIn<Fixture>(h.fixtures, id, fixed);
  return fixtures ? { ...h, fixtures } : h;
}

export function removeFixture(h: House, id: Id): House {
  const fixtures = h.fixtures.filter((f) => f.id !== id);
  return fixtures.length === h.fixtures.length ? h : { ...h, fixtures };
}
