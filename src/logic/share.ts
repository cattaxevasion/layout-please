// 공유 링크: 집 구조 + 배치안 하나를 압축 형식으로 바꿔 lz-string으로 URL 해시(#s=...)에 담는다.
//
// 링크를 짧게 하려고 객체를 필드 이름 없는 고정 순서 배열로 바꾸고, id는 짧은 번호(36진수)로 다시 매긴다.
// 형식을 바꿀 때는 FORMAT을 올리고 fromCompact에 옛 형식 처리를 남겨 둔다.
// 형식 2: 마감재(바닥재·벽지·문 표면)와 미닫이 문짝 수를 배열 끝에 추가. 형식 1 링크도 그대로 읽힌다.

import LZString from 'lz-string';
import { DocError, migrateShare } from '../model/migrate';
import { SCHEMA_VERSION } from '../model/types';
import type { DoorType, House, Layout, SharePayload, ShapeKind } from '../model/types';

export const SHARE_PREFIX = '#s=';
/** 이보다 길면 일부 메신저·게시판에서 링크가 잘릴 수 있다 */
export const SHARE_WARN_LENGTH = 2000;
/** 이보다 길면 브라우저나 서비스에 따라 아예 열리지 않을 수 있다 */
export const SHARE_DANGER_LENGTH = 16000;

const FORMAT = 2;
const READABLE_FORMATS = [1, 2];
const DOOR_TYPES: DoorType[] = ['hinged', 'folding', 'sliding', 'opening'];

/** 0.01cm 단위로 반올림 (부동소수 꼬리 제거) */
const n = (v: number) => Math.round(v * 100) / 100;

type Tuple = (string | number | null | number[])[];

interface CompactHouse {
  c: number; // 천장 높이
  g?: string | null; // 집 기본 벽지
  r: Tuple[]; // 방
  w: Tuple[]; // 벽
  d: Tuple[]; // 문
  n: Tuple[]; // 창
  x: Tuple[]; // 붙박이 설비
}

interface Compact extends CompactHouse {
  v: number; // 스키마 버전
  f: number; // 압축 형식 버전
  l: [string, Tuple[]]; // 배치안 이름, 가구
}

function idTable() {
  const ids = new Map<string, string>();
  return (raw: string) => {
    let v = ids.get(raw);
    if (!v) {
      v = ids.size.toString(36);
      ids.set(raw, v);
    }
    return v;
  };
}

function compactHouse(house: House, id: (raw: string) => string): CompactHouse {
  return {
    c: n(house.ceilingHeight),
    g: house.wallFinish ?? null,
    r: house.rooms.map((r) => [
      id(r.id),
      r.name,
      r.floorColor,
      r.points.flatMap((p) => [n(p.x), n(p.y)]),
      r.floorFinish ?? null,
    ]),
    w: house.walls.map((w) => [
      id(w.id),
      n(w.a.x),
      n(w.a.y),
      n(w.b.x),
      n(w.b.y),
      n(w.thickness),
      w.roomId ? id(w.roomId) : null,
      w.finish ?? null,
    ]),
    d: house.doors.map((d) => [
      id(d.id),
      id(d.wallId),
      n(d.offset),
      n(d.width),
      DOOR_TYPES.indexOf(d.type),
      n(d.height),
      d.hinge === 'start' ? 0 : 1,
      d.side,
      n(d.swingRadius),
      n(d.swingAngle),
      d.finish ?? null,
      d.panels ?? null,
    ]),
    n: house.windows.map((o) => [id(o.id), id(o.wallId), n(o.offset), n(o.width), n(o.sillHeight), n(o.height)]),
    x: house.fixtures.map((f) => [id(f.id), f.name, n(f.x), n(f.y), n(f.width), n(f.depth), n(f.height), n(f.rotation), f.color]),
  };
}

/**
 * id와 상관없는 집 구조 비교용 문자열. 공유 링크를 거치면 id가 바뀌므로,
 * "같은 집인지"는 이것으로 판단한다 (id는 나오는 순서대로 다시 매겨진다).
 */
export function houseSignature(house: House): string {
  return JSON.stringify(compactHouse(house, idTable()));
}

function toCompact(house: House, layout: Layout): Compact {
  const id = idTable();
  return {
    v: SCHEMA_VERSION,
    f: FORMAT,
    ...compactHouse(house, id),
    l: [
      layout.name,
      layout.furniture.map((f) => [
        id(f.id),
        f.name,
        f.shape,
        n(f.width),
        n(f.depth),
        n(f.height),
        f.color,
        n(f.x),
        n(f.y),
        n(f.rotation),
      ]),
    ],
  };
}

function fromCompact(c: Compact): unknown {
  if (!READABLE_FORMATS.includes(c.f)) {
    throw new DocError('이 앱보다 새로운 형식의 공유 링크입니다. 페이지를 새로고침해 주세요.');
  }
  /** 형식 1 링크에는 없는 뒤쪽 칸은 undefined → 필드를 만들지 않는다 */
  const opt = <K extends string>(key: K, v: unknown) => (typeof v === 'string' || typeof v === 'number' ? { [key]: v } : {});
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
  const str = (v: unknown) => String(v ?? '');
  return {
    version: c.v,
    house: {
      ceilingHeight: c.c,
      ...opt('wallFinish', c.g),
      rooms: c.r.map(([id, name, color, pts, floorFinish]) => {
        const flat = pts as number[];
        const points = [];
        for (let i = 0; i + 1 < flat.length; i += 2) points.push({ x: flat[i], y: flat[i + 1] });
        return { id: str(id), name: str(name), floorColor: str(color), points, ...opt('floorFinish', floorFinish) };
      }),
      walls: c.w.map(([id, ax, ay, bx, by, t, roomId, finish]) => ({
        id: str(id),
        a: { x: num(ax), y: num(ay) },
        b: { x: num(bx), y: num(by) },
        thickness: num(t),
        ...(roomId !== null && roomId !== undefined ? { roomId: str(roomId) } : {}),
        ...opt('finish', finish),
      })),
      doors: c.d.map(([id, wallId, offset, width, type, height, hinge, side, radius, angle, finish, panels]) => ({
        id: str(id),
        wallId: str(wallId),
        offset: num(offset),
        width: num(width),
        type: DOOR_TYPES[num(type)] ?? 'hinged',
        height: num(height),
        hinge: hinge === 0 ? 'start' : 'end',
        side: side === 1 ? 1 : -1,
        swingRadius: num(radius),
        swingAngle: num(angle),
        ...opt('finish', finish),
        ...opt('panels', panels),
      })),
      windows: c.n.map(([id, wallId, offset, width, sill, height]) => ({
        id: str(id),
        wallId: str(wallId),
        offset: num(offset),
        width: num(width),
        sillHeight: num(sill),
        height: num(height),
      })),
      fixtures: c.x.map(([id, name, x, y, w, d, h, rot, color]) => ({
        id: str(id),
        name: str(name),
        x: num(x),
        y: num(y),
        width: num(w),
        depth: num(d),
        height: num(h),
        rotation: num(rot),
        color: str(color),
      })),
    },
    layout: {
      id: 'shared',
      name: c.l[0],
      updatedAt: Date.now(),
      furniture: c.l[1].map(([id, name, shape, w, d, h, color, x, y, rot]) => ({
        id: str(id),
        name: str(name),
        shape: str(shape) as ShapeKind,
        width: num(w),
        depth: num(d),
        height: num(h),
        color: str(color),
        x: num(x),
        y: num(y),
        rotation: num(rot),
      })),
    },
  };
}

export function encodeShare(house: House, layout: Layout): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(toCompact(house, layout)));
}

export function decodeShare(encoded: string): SharePayload {
  const broken = () => new DocError('공유 링크가 손상되었거나 일부가 잘렸습니다.');
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw broken();
  let raw: unknown;
  try {
    raw = fromCompact(JSON.parse(json) as Compact);
  } catch (e) {
    if (e instanceof DocError) throw e;
    throw broken();
  }
  return migrateShare(raw);
}

/** location.origin + pathname 같은 기준 주소에 해시를 붙인다 */
export function buildShareUrl(base: string, house: House, layout: Layout): string {
  return `${base}${SHARE_PREFIX}${encodeShare(house, layout)}`;
}

/** 해시에 공유 데이터가 없으면 null, 있는데 깨졌으면 DocError */
export function parseShareHash(hash: string): SharePayload | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  return decodeShare(hash.slice(SHARE_PREFIX.length));
}

export type ShareSizeLevel = 'ok' | 'warn' | 'danger';

export function shareSizeLevel(url: string): ShareSizeLevel {
  if (url.length > SHARE_DANGER_LENGTH) return 'danger';
  if (url.length > SHARE_WARN_LENGTH) return 'warn';
  return 'ok';
}
