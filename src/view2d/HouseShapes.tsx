// 집 구조(방, 벽, 문, 창, 붙박이 설비)와 공용 도형 컴포넌트.
// data-hit / data-id 속성은 구조 편집 모드의 클릭 판정에 쓴다.

import { memo } from 'preact/compat';
import { signedArea } from '../geometry/polygon';
import { add, scale } from '../geometry/vec';
import { doorSwing, openingPolygon, openingSpan, wallFrame, wallPolygon } from '../logic/openings';
import type { Door, House, Room, Selection, Vec2, Wall } from '../model/types';

export const ptsAttr = (pts: readonly Vec2[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

const isSel = (sel: Selection | null, kind: Selection['kind'], id: string) => sel?.kind === kind && sel.id === id;

// 가구를 끄는 동안에는 집 구조가 그대로이므로 다시 그리지 않는다
export const HouseShapes = memo(function HouseShapes({
  house,
  px,
  selection,
}: {
  house: House;
  px: number;
  selection: Selection | null;
}) {
  const walls = new Map(house.walls.map((w) => [w.id, w]));
  return (
    <>
      {house.rooms.map((r) => (
        <polygon
          key={r.id}
          points={ptsAttr(r.points)}
          fill={r.floorColor}
          class={`room${isSel(selection, 'room', r.id) ? ' selected' : ''}`}
          data-hit="room"
          data-id={r.id}
        />
      ))}
      {house.rooms.map((r) => (
        <RoomLabel key={r.id} room={r} px={px} />
      ))}
      {house.walls.map((w) => (
        <polygon
          key={w.id}
          points={ptsAttr(wallPolygon(w))}
          class={`wall${isSel(selection, 'wall', w.id) ? ' selected' : ''}`}
          data-hit="wall"
          data-id={w.id}
        />
      ))}
      {house.windows.map((o) => {
        const w = walls.get(o.wallId);
        if (!w) return null;
        const [s, e] = openingSpan(w, o);
        return (
          <g key={o.id} class={`window${isSel(selection, 'window', o.id) ? ' selected' : ''}`} data-hit="window" data-id={o.id}>
            <polygon points={ptsAttr(openingPolygon(w, o))} />
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} />
          </g>
        );
      })}
      {house.doors.map((d) => {
        const w = walls.get(d.wallId);
        return w ? <DoorShape key={d.id} door={d} wall={w} px={px} selected={isSel(selection, 'door', d.id)} /> : null;
      })}
      {house.fixtures.map((f) => (
        <g
          key={f.id}
          transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
          class={`fixture${isSel(selection, 'fixture', f.id) ? ' selected' : ''}`}
          data-hit="fixture"
          data-id={f.id}
        >
          <rect x={-f.width / 2} y={-f.depth / 2} width={f.width} height={f.depth} />
        </g>
      ))}
      {house.fixtures.map((f) => (
        <Label key={f.id} x={f.x} y={f.y} px={px} text={f.name} minSize={Math.min(f.width, f.depth) / px} muted />
      ))}
    </>
  );
});

function RoomLabel({ room, px }: { room: Room; px: number }) {
  const c = polygonCentroid(room.points);
  const area = Math.abs(signedArea(room.points)) / 10000;
  return (
    <text x={c.x} y={c.y} class="room-label" font-size={14 * px} text-anchor="middle">
      {room.name}
      <tspan x={c.x} dy={16 * px} font-size={11 * px}>
        {area.toFixed(1)}㎡ · {(area / 1.62).toFixed(1)}첩
      </tspan>
    </text>
  );
}

export function polygonCentroid(pts: readonly Vec2[]): Vec2 {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-9) return pts[0] ?? { x: 0, y: 0 };
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const k = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * k;
    cy += (p.y + q.y) * k;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

function DoorShape({ door, wall, px, selected }: { door: Door; wall: Wall; px: number; selected: boolean }) {
  const cls = `door${selected ? ' selected' : ''}`;
  const gap = <polygon points={ptsAttr(openingPolygon(wall, door))} class="door-gap" />;
  if (door.type === 'opening') {
    return (
      <g class={cls} data-hit="door" data-id={door.id}>
        {gap}
      </g>
    );
  }
  if (door.type === 'sliding') {
    // 문짝을 벽 두께 안에 얇은 사각형으로
    const { n, u } = wallFrame(wall);
    const [s, e] = openingSpan(wall, door);
    const off = scale(n, (door.side * wall.thickness) / 6);
    const ht = scale(n, Math.max(2, wall.thickness / 4) / 2);
    const a = add(s, off);
    const b = add(e, off);
    return (
      <g class={cls} data-hit="door" data-id={door.id}>
        {gap}
        <polygon points={ptsAttr([add(a, ht), add(b, ht), add(b, scale(ht, -1)), add(a, scale(ht, -1))])} />
        <line x1={b.x - u.x * 6 * px} y1={b.y - u.y * 6 * px} x2={b.x} y2={b.y} />
      </g>
    );
  }
  const { hinge, closedDir, openDir, radius } = doorSwing(wall, door);
  const open = add(hinge, scale(openDir, radius));
  const closed = add(hinge, scale(closedDir, radius));
  const sweep = closedDir.x * openDir.y - closedDir.y * openDir.x > 0 ? 0 : 1;
  return (
    <g class={cls} data-hit="door" data-id={door.id}>
      {gap}
      <path
        d={`M ${hinge.x} ${hinge.y} L ${open.x} ${open.y} A ${radius} ${radius} 0 0 ${sweep} ${closed.x} ${closed.y} Z`}
        class="door-swing"
      />
      <line x1={hinge.x} y1={hinge.y} x2={open.x} y2={open.y} />
    </g>
  );
}

export function Label(props: {
  x: number;
  y: number;
  px: number;
  text: string;
  sub?: string;
  /** 대상의 짧은 변이 화면에서 몇 px인지. 너무 작으면 글자를 숨긴다 */
  minSize: number;
  muted?: boolean;
}) {
  const { x, y, px, text, sub, minSize, muted } = props;
  if (minSize < 26) return null;
  const fs = 11 * px;
  return (
    <text
      x={x}
      y={sub ? y - fs * 0.2 : y + fs * 0.35}
      font-size={fs}
      text-anchor="middle"
      class={muted ? 'label muted' : 'label'}
      stroke-width={3 * px}
    >
      {text}
      {sub && (
        <tspan x={x} dy={fs * 1.2} font-size={fs * 0.9}>
          {sub}
        </tspan>
      )}
    </text>
  );
}

export function DimText({ x, y, px, text }: { x: number; y: number; px: number; text: string }) {
  const fs = 11 * px;
  return (
    <text x={x} y={y + fs * 0.35} font-size={fs} text-anchor="middle" class="dim-text" stroke-width={3 * px}>
      {text}
    </text>
  );
}

/** 그리드: 화면에서 너무 촘촘하지 않은 간격을 고르고, 1m마다 진한 선 */
export const Grid = memo(function Grid({
  bounds,
  s,
  gridSize,
}: {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  s: number;
  gridSize: number;
}) {
  const minor = [gridSize, 10, 25, 50, 100].filter((g) => g >= gridSize).find((g) => g * s >= 8) ?? 100;
  const pad = 2000;
  const x = Math.floor((bounds.minX - pad) / 100) * 100;
  const y = Math.floor((bounds.minY - pad) / 100) * 100;
  const w = bounds.maxX - bounds.minX + pad * 2;
  const h = bounds.maxY - bounds.minY + pad * 2;
  const sw = 1 / s;
  return (
    <>
      <defs>
        <pattern id="grid-minor" width={minor} height={minor} patternUnits="userSpaceOnUse" x={0} y={0}>
          <path d={`M ${minor} 0 L 0 0 0 ${minor}`} fill="none" class="grid-minor" stroke-width={sw} />
        </pattern>
        <pattern id="grid-major" width={100} height={100} patternUnits="userSpaceOnUse" x={0} y={0}>
          <rect width={100} height={100} fill="url(#grid-minor)" />
          <path d="M 100 0 L 0 0 0 100" fill="none" class="grid-major" stroke-width={sw} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={minor < 100 ? 'url(#grid-major)' : 'url(#grid-minor)'} />
    </>
  );
});

