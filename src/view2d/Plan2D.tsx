// 2D 평면도 (SVG). 좌표 단위는 cm 그대로 쓰고, 화면 이동·확대는 viewBox로만 처리한다.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { pointsAabb, type Segment } from '../geometry/obb';
import { signedArea } from '../geometry/polygon';
import { add, scale } from '../geometry/vec';
import { distancesToWalls, formatCm } from '../logic/measure';
import { doorSwing, openingPolygon, openingSpan, wallFrame, wallPolygon } from '../logic/openings';
import { snapRect, snapTargets } from '../logic/snap';
import { BUILTIN_PRESETS } from '../model/presets';
import type { Door, Furniture, House, Room, Vec2 } from '../model/types';
import { actions, store, useApp } from '../store';
import { selectFurnitureList, selectHouse, selectSelectedFurniture } from '../store/selectors';
import { FurnitureGlyph } from './FurnitureGlyph';
import { registerViewCenter } from './viewApi';

interface Camera {
  /** 화면 가운데의 월드 좌표 */
  cx: number;
  cy: number;
  /** 1cm가 몇 px인지 */
  s: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 20;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const ptsAttr = (pts: readonly Vec2[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

function houseBounds(h: House) {
  const pts: Vec2[] = h.rooms.flatMap((r) => r.points);
  for (const w of h.walls) pts.push(...wallPolygon(w));
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 500, maxY: 500 };
  return pointsAabb(pts);
}

function fitCamera(h: House, w: number, hgt: number): Camera {
  const b = houseBounds(h);
  const bw = Math.max(50, b.maxX - b.minX);
  const bh = Math.max(50, b.maxY - b.minY);
  const s = clampScale(Math.min(w / bw, hgt / bh) * 0.88);
  return { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, s };
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; startX: number; startY: number; cam: Camera; moved: boolean }
  | { kind: 'drag'; id: string; offset: Vec2; targets: Segment[] }
  | { kind: 'pinch'; dist: number; mid: Vec2; cam: Camera };

export function Plan2D() {
  const house = useApp(selectHouse);
  const furniture = useApp(selectFurnitureList);
  const selected = useApp(selectSelectedFurniture);
  const snap = useApp((s) => s.ui.snap);

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera | null>(null);
  const [guides, setGuides] = useState<Segment[]>([]);

  const camRef = useRef(cam);
  camRef.current = cam;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const pointers = useRef(new Map<number, Vec2>());
  const gesture = useRef<Gesture>({ kind: 'none' });

  // 크기 추적
  useEffect(() => {
    const el = svgRef.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 처음 크기를 알게 되면 집 전체가 보이게
  useEffect(() => {
    if (!cam && size.w > 0 && size.h > 0) setCam(fitCamera(house, size.w, size.h));
  }, [size, cam, house]);

  useEffect(() => {
    registerViewCenter(() => {
      const c = camRef.current;
      return c ? { x: c.cx, y: c.cy } : { x: 0, y: 0 };
    });
    return () => registerViewCenter(null);
  }, []);

  /** 화면(client) 좌표 → 월드(cm) 좌표 */
  function toWorld(clientX: number, clientY: number, c = camRef.current!): Vec2 {
    const r = svgRef.current!.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return { x: c.cx + (clientX - r.left - w / 2) / c.s, y: c.cy + (clientY - r.top - h / 2) / c.s };
  }

  /** 화면 좌표 (px, py)에 있는 월드 점이 그대로 있도록 확대/축소 */
  function zoomAt(clientX: number, clientY: number, factor: number) {
    const c = camRef.current;
    if (!c) return;
    const r = svgRef.current!.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const px = clientX - r.left - w / 2;
    const py = clientY - r.top - h / 2;
    const s = clampScale(c.s * factor);
    const wx = c.cx + px / c.s;
    const wy = c.cy + py / c.s;
    setCam({ cx: wx - px / s, cy: wy - py / s, s });
  }

  // 휠 확대/축소 (preventDefault를 위해 passive가 아닌 리스너로 등록)
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function endDrag() {
    if (gesture.current.kind === 'drag') {
      actions.endGesture();
      setGuides([]);
    }
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    gesture.current = {
      kind: 'pinch',
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      cam: camRef.current!,
    };
  }

  function onPointerDown(e: PointerEvent) {
    if (!camRef.current) return;
    if (e.button !== 0 && e.button !== 1) return;
    svgRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      endDrag();
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;

    const el = (e.target as Element).closest('[data-fid]');
    const ui = store.getState().ui;
    if (el && e.button === 0) {
      const id = el.getAttribute('data-fid')!;
      actions.select({ kind: 'furniture', id });
      const f = selectFurnitureList(store.getState()).find((x) => x.id === id);
      if (!f || ui.readOnly) {
        gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, cam: camRef.current, moved: false };
        return;
      }
      const p = toWorld(e.clientX, e.clientY);
      actions.beginGesture();
      gesture.current = {
        kind: 'drag',
        id,
        offset: { x: p.x - f.x, y: p.y - f.y },
        targets: snapTargets(house, furniture, id, ui.snap),
      };
    } else {
      gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, cam: camRef.current, moved: false };
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (g.kind === 'pan') {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (!g.moved && Math.hypot(dx, dy) < 3) return;
      g.moved = true;
      setCam({ ...g.cam, cx: g.cam.cx - dx / g.cam.s, cy: g.cam.cy - dy / g.cam.s });
    } else if (g.kind === 'drag') {
      const f = selectFurnitureList(store.getState()).find((x) => x.id === g.id);
      if (!f) return;
      const p = toWorld(e.clientX, e.clientY);
      const raw = { ...f, x: p.x - g.offset.x, y: p.y - g.offset.y };
      const sn = store.getState().ui.snap;
      // Alt를 누르고 있으면 스냅을 잠시 끈다
      const res = e.altKey
        ? { x: raw.x, y: raw.y, guides: [] }
        : snapRect(raw, { ...sn, targets: g.targets });
      actions.moveFurniture(g.id, round1(res.x), round1(res.y));
      setGuides(res.guides);
    } else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const r = svgRef.current!.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const s = clampScale(g.cam.s * (dist / g.dist));
      // 처음 두 손가락 가운데 있던 월드 점이 지금 두 손가락 가운데에 오도록
      const wx = g.cam.cx + (g.mid.x - r.left - w / 2) / g.cam.s;
      const wy = g.cam.cy + (g.mid.y - r.top - h / 2) / g.cam.s;
      setCam({ cx: wx - (mid.x - r.left - w / 2) / s, cy: wy - (mid.y - r.top - h / 2) / s, s });
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === 'pan' && !g.moved) {
      // 빈 곳을 클릭하면 선택 해제 (가구 위 클릭은 pointerdown에서 이미 선택됨)
      const onFurniture = (e.target as Element).closest('[data-fid]');
      if (!onFurniture) actions.select(null);
    }
    endDrag();
    if (pointers.current.size === 1 && g.kind === 'pinch') {
      // 두 손가락 중 하나를 떼면 남은 손가락으로 계속 이동
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: 'pan', startX: p.x, startY: p.y, cam: camRef.current!, moved: true };
    } else if (pointers.current.size === 0) {
      gesture.current = { kind: 'none' };
    }
  }

  // 패널에서 끌어다 놓기
  function onDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('text/x-preset')) e.preventDefault();
  }
  function onDrop(e: DragEvent) {
    const id = e.dataTransfer?.getData('text/x-preset');
    if (!id || !camRef.current) return;
    e.preventDefault();
    const preset = [...BUILTIN_PRESETS, ...store.getState().history.present.userPresets].find(
      (p) => p.id === id,
    );
    if (preset) {
      const p = toWorld(e.clientX, e.clientY);
      actions.addFromPreset(preset, { x: round1(p.x), y: round1(p.y) });
    }
  }

  const viewBox = cam
    ? `${cam.cx - size.w / 2 / cam.s} ${cam.cy - size.h / 2 / cam.s} ${size.w / cam.s} ${size.h / cam.s}`
    : '0 0 100 100';
  const px = cam ? 1 / cam.s : 1; // 화면 1px의 월드 길이

  const bounds = useMemo(() => houseBounds(house), [house]);
  const distances = useMemo(
    () => (selected ? distancesToWalls(selected, house) : []),
    [selected, house],
  );

  return (
    <div class="plan2d">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={(e) => e.preventDefault()}
      >
        {cam && (
          <>
            <Grid bounds={bounds} cam={cam} gridSize={snap.gridSize} />
            {house.rooms.map((r) => (
              <RoomShape key={r.id} room={r} px={px} />
            ))}
            {house.walls.map((w) => (
              <polygon key={w.id} points={ptsAttr(wallPolygon(w))} class="wall" />
            ))}
            <Openings house={house} px={px} />
            {house.fixtures.map((f) => (
              <g key={f.id} transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`} class="fixture">
                <rect x={-f.width / 2} y={-f.depth / 2} width={f.width} height={f.depth} />
              </g>
            ))}
            {house.fixtures.map((f) => (
              <Label key={f.id} x={f.x} y={f.y} px={px} text={f.name} minSize={Math.min(f.width, f.depth) / px} muted />
            ))}
            {furniture.map((f) => (
              <FurnitureItem key={f.id} f={f} selected={selected?.id === f.id} />
            ))}
            {furniture.map((f) => (
              <Label
                key={f.id}
                x={f.x}
                y={f.y}
                px={px}
                text={f.name}
                sub={selected?.id === f.id ? `${formatCm(f.width)}×${formatCm(f.depth)}` : undefined}
                minSize={Math.min(f.width, f.depth) / px}
              />
            ))}
            {distances.map(
              (d) =>
                d.distance >= 1 && (
                  <g key={d.side} class="dim">
                    <line x1={d.from.x} y1={d.from.y} x2={d.to.x} y2={d.to.y} />
                    <DimText
                      x={(d.from.x + d.to.x) / 2}
                      y={(d.from.y + d.to.y) / 2}
                      px={px}
                      text={formatCm(d.distance)}
                    />
                  </g>
                ),
            )}
            {guides.map((g, i) => (
              <line key={i} class="snap-guide" x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} />
            ))}
          </>
        )}
      </svg>
      <div class="plan-tools">
        <button title="확대" onClick={() => cam && setCam({ ...cam, s: clampScale(cam.s * 1.25) })}>
          +
        </button>
        <button title="축소" onClick={() => cam && setCam({ ...cam, s: clampScale(cam.s / 1.25) })}>
          −
        </button>
        <button title="집 전체 보기" onClick={() => setCam(fitCamera(house, size.w, size.h))}>
          맞춤
        </button>
      </div>
    </div>
  );
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function FurnitureItem({ f, selected }: { f: Furniture; selected: boolean }) {
  return (
    <g
      data-fid={f.id}
      class={`furniture${selected ? ' selected' : ''}`}
      transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
    >
      <FurnitureGlyph
        f={f}
        fill={f.color}
        stroke={selected ? 'var(--accent)' : 'rgba(0,0,0,0.55)'}
        strokeWidth={selected ? 2 : 1}
      />
    </g>
  );
}

function RoomShape({ room, px }: { room: Room; px: number }) {
  const c = polygonCentroid(room.points);
  const area = Math.abs(signedArea(room.points)) / 10000;
  return (
    <>
      <polygon points={ptsAttr(room.points)} fill={room.floorColor} class="room" />
      <text x={c.x} y={c.y} class="room-label" font-size={14 * px} text-anchor="middle">
        {room.name}
        <tspan x={c.x} dy={16 * px} font-size={11 * px}>
          {area.toFixed(1)}㎡
        </tspan>
      </text>
    </>
  );
}

function polygonCentroid(pts: readonly Vec2[]): Vec2 {
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

function Openings({ house, px }: { house: House; px: number }) {
  const walls = new Map(house.walls.map((w) => [w.id, w]));
  return (
    <>
      {house.windows.map((o) => {
        const w = walls.get(o.wallId);
        if (!w) return null;
        const [s, e] = openingSpan(w, o);
        return (
          <g key={o.id} class="window">
            <polygon points={ptsAttr(openingPolygon(w, o))} />
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} />
          </g>
        );
      })}
      {house.doors.map((d) => {
        const w = walls.get(d.wallId);
        return w ? <DoorShape key={d.id} door={d} wall={w} px={px} /> : null;
      })}
    </>
  );
}

function DoorShape({ door, wall, px }: { door: Door; wall: House['walls'][number]; px: number }) {
  const gap = <polygon points={ptsAttr(openingPolygon(wall, door))} class="door-gap" />;
  if (door.type === 'opening') return gap;
  if (door.type === 'sliding') {
    // 문짝을 벽 두께 안쪽에 얇은 사각형으로
    const { n, u } = wallFrame(wall);
    const [s, e] = openingSpan(wall, door);
    const off = scale(n, (door.side * wall.thickness) / 6);
    const t = Math.max(2, wall.thickness / 4) / 2;
    const ht = scale(n, t);
    const a = add(s, off);
    const b = add(e, off);
    return (
      <g class="door">
        {gap}
        <polygon points={ptsAttr([add(a, ht), add(b, ht), add(b, scale(ht, -1)), add(a, scale(ht, -1))])} />
        <line x1={b.x - u.x * 6 * px} y1={b.y - u.y * 6 * px} x2={b.x} y2={b.y} class="door-arrow" />
      </g>
    );
  }
  const { hinge, closedDir, openDir, radius } = doorSwing(wall, door);
  const open = add(hinge, scale(openDir, radius));
  const closed = add(hinge, scale(closedDir, radius));
  const sweep = closedDir.x * openDir.y - closedDir.y * openDir.x > 0 ? 0 : 1;
  return (
    <g class="door">
      {gap}
      <line x1={hinge.x} y1={hinge.y} x2={open.x} y2={open.y} />
      <path d={`M ${open.x} ${open.y} A ${radius} ${radius} 0 0 ${sweep} ${closed.x} ${closed.y}`} class="door-arc" />
    </g>
  );
}

function Label(props: {
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

function DimText({ x, y, px, text }: { x: number; y: number; px: number; text: string }) {
  const fs = 11 * px;
  return (
    <text x={x} y={y + fs * 0.35} font-size={fs} text-anchor="middle" class="dim-text" stroke-width={3 * px}>
      {text}
    </text>
  );
}

/** 그리드: 화면에서 너무 촘촘하지 않은 간격을 고르고, 1m마다 진한 선 */
function Grid({ bounds, cam, gridSize }: { bounds: ReturnType<typeof houseBounds>; cam: Camera; gridSize: number }) {
  const candidates = [gridSize, 10, 25, 50, 100].filter((g) => g >= gridSize);
  const minor = candidates.find((g) => g * cam.s >= 8) ?? 100;
  const pad = 2000;
  const x = Math.floor((bounds.minX - pad) / 100) * 100;
  const y = Math.floor((bounds.minY - pad) / 100) * 100;
  const w = bounds.maxX - bounds.minX + pad * 2;
  const h = bounds.maxY - bounds.minY + pad * 2;
  const sw = 1 / cam.s;
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
}
