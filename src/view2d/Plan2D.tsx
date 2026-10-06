// 2D 평면도 (SVG). 좌표 단위는 cm 그대로 쓰고, 화면 이동·확대는 viewBox로만 처리한다.
// 배치 모드에서는 가구만, 구조 편집 모드에서는 방·벽·문·창·설비만 조작할 수 있다.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Segment } from '../geometry/obb';
import { dot, sub } from '../geometry/vec';
import { distancesToWalls, formatCm } from '../logic/measure';
import { wallFrame } from '../logic/openings';
import { snapPoint, snapRect, snapTargets, snapToGrid } from '../logic/snap';
import { BUILTIN_PRESETS } from '../model/presets';
import type { Furniture, Vec2 } from '../model/types';
import { actions, store, useApp } from '../store';
import { selectFurnitureList, selectHouse, selectSelectedFurniture } from '../store/selectors';
import { clampScale, fitCamera, houseBounds, type Camera } from './camera';
import { FurnitureGlyph } from './FurnitureGlyph';
import { DimText, Grid, HouseShapes, Label } from './HouseShapes';
import { StructureOverlay } from './StructureOverlay';
import { registerViewCenter } from './viewApi';

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; startX: number; startY: number; cam: Camera; moved: boolean }
  | { kind: 'furniture'; id: string; offset: Vec2; targets: Segment[] }
  | { kind: 'fixture'; id: string; offset: Vec2; targets: Segment[] }
  | { kind: 'vertex'; roomId: string; index: number; refs: Vec2[] }
  | { kind: 'wallEnd'; wallId: string; end: 'a' | 'b'; refs: Vec2[] }
  | { kind: 'opening'; type: 'door' | 'window'; id: string; grab: number }
  | { kind: 'pinch'; dist: number; mid: Vec2; cam: Camera };

const round1 = (v: number) => Math.round(v * 10) / 10;

export function Plan2D() {
  const house = useApp(selectHouse);
  const furniture = useApp(selectFurnitureList);
  const selected = useApp(selectSelectedFurniture);
  const selection = useApp((s) => s.ui.selection);
  const mode = useApp((s) => s.ui.mode);
  const gridSize = useApp((s) => s.ui.snap.gridSize);

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

  useEffect(() => {
    const el = svgRef.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

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

  function toWorld(clientX: number, clientY: number, c = camRef.current!): Vec2 {
    const r = svgRef.current!.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    return { x: c.cx + (clientX - r.left - w / 2) / c.s, y: c.cy + (clientY - r.top - h / 2) / c.s };
  }

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

  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function endEdit() {
    const k = gesture.current.kind;
    if (k !== 'none' && k !== 'pan' && k !== 'pinch') {
      actions.endGesture();
      setGuides([]);
    }
  }

  function startPan(e: PointerEvent) {
    gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, cam: camRef.current!, moved: false };
  }

  /** 클릭한 요소에서 data-hit 정보를 읽는다 */
  function hitOf(target: EventTarget | null) {
    const el = (target as Element | null)?.closest?.('[data-hit]');
    if (!el) return null;
    return { kind: el.getAttribute('data-hit')!, id: el.getAttribute('data-id') ?? '', el };
  }

  function beginStructure(e: PointerEvent): boolean {
    const hit = hitOf(e.target);
    if (!hit) return false;
    const state = store.getState();
    const h = state.history.present.house;
    const p = toWorld(e.clientX, e.clientY);

    switch (hit.kind) {
      case 'vertex': {
        const index = Number(hit.el.getAttribute('data-index'));
        actions.select({ kind: 'room', id: hit.id, vertex: index });
        const refs = h.rooms.flatMap((r) => r.points.filter((_, i) => !(r.id === hit.id && i === index)));
        actions.beginGesture();
        gesture.current = { kind: 'vertex', roomId: hit.id, index, refs };
        return true;
      }
      case 'insert': {
        actions.insertVertex(hit.id, Number(hit.el.getAttribute('data-index')));
        startPan(e);
        return true;
      }
      case 'wallEnd': {
        const end = hit.el.getAttribute('data-end') as 'a' | 'b';
        const refs = [...h.rooms.flatMap((r) => r.points), ...h.walls.filter((w) => w.id !== hit.id).flatMap((w) => [w.a, w.b])];
        actions.beginGesture();
        gesture.current = { kind: 'wallEnd', wallId: hit.id, end, refs };
        return true;
      }
      case 'door':
      case 'window': {
        const type = hit.kind;
        actions.select({ kind: type, id: hit.id });
        const o = type === 'door' ? h.doors.find((d) => d.id === hit.id) : h.windows.find((d) => d.id === hit.id);
        const w = o && h.walls.find((x) => x.id === o.wallId);
        if (!o || !w) return true;
        const s = dot(sub(p, w.a), wallFrame(w).u);
        actions.beginGesture();
        gesture.current = { kind: 'opening', type, id: hit.id, grab: s - o.offset };
        return true;
      }
      case 'fixture': {
        actions.select({ kind: 'fixture', id: hit.id });
        const f = h.fixtures.find((x) => x.id === hit.id);
        if (!f) return true;
        actions.beginGesture();
        gesture.current = {
          kind: 'fixture',
          id: hit.id,
          offset: { x: p.x - f.x, y: p.y - f.y },
          targets: snapTargets(h, [], hit.id, state.ui.snap),
        };
        return true;
      }
      case 'wall':
        actions.select({ kind: 'wall', id: hit.id });
        startPan(e);
        return true;
      case 'room':
        actions.select({ kind: 'room', id: hit.id });
        startPan(e);
        return true;
    }
    return false;
  }

  function onPointerDown(e: PointerEvent) {
    if (!camRef.current) return;
    if (e.button !== 0 && e.button !== 1) return;
    svgRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      endEdit();
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        cam: camRef.current,
      };
      return;
    }
    if (pointers.current.size > 2) return;

    const ui = store.getState().ui;
    if (e.button === 1 || ui.readOnly) return startPan(e);

    if (ui.mode === 'structure') {
      if (!beginStructure(e)) startPan(e);
      return;
    }

    const el = (e.target as Element).closest('[data-fid]');
    if (!el) return startPan(e);
    const id = el.getAttribute('data-fid')!;
    actions.select({ kind: 'furniture', id });
    const f = selectFurnitureList(store.getState()).find((x) => x.id === id);
    if (!f) return startPan(e);
    const p = toWorld(e.clientX, e.clientY);
    actions.beginGesture();
    gesture.current = {
      kind: 'furniture',
      id,
      offset: { x: p.x - f.x, y: p.y - f.y },
      targets: snapTargets(house, furniture, id, ui.snap),
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const sn = store.getState().ui.snap;
    const free = e.altKey; // Alt를 누르고 있으면 스냅을 잠시 끈다

    switch (g.kind) {
      case 'pan': {
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;
        if (!g.moved && Math.hypot(dx, dy) < 3) return;
        g.moved = true;
        setCam({ ...g.cam, cx: g.cam.cx - dx / g.cam.s, cy: g.cam.cy - dy / g.cam.s });
        return;
      }
      case 'furniture':
      case 'fixture': {
        const h = store.getState().history.present.house;
        const f =
          g.kind === 'furniture'
            ? selectFurnitureList(store.getState()).find((x) => x.id === g.id)
            : h.fixtures.find((x) => x.id === g.id);
        if (!f) return;
        const p = toWorld(e.clientX, e.clientY);
        const raw = { ...f, x: p.x - g.offset.x, y: p.y - g.offset.y };
        const res = free ? { x: raw.x, y: raw.y, guides: [] } : snapRect(raw, { ...sn, targets: g.targets });
        if (g.kind === 'furniture') actions.moveFurniture(g.id, round1(res.x), round1(res.y));
        else actions.updateFixture(g.id, { x: round1(res.x), y: round1(res.y) });
        setGuides(res.guides);
        return;
      }
      case 'vertex':
      case 'wallEnd': {
        const p = toWorld(e.clientX, e.clientY);
        const res = free ? { x: p.x, y: p.y, guides: [] } : snapPoint(p, g.refs, sn);
        const q = { x: round1(res.x), y: round1(res.y) };
        if (g.kind === 'vertex') actions.moveVertex(g.roomId, g.index, q);
        else actions.updateWall(g.wallId, { [g.end]: q });
        setGuides(res.guides);
        return;
      }
      case 'opening': {
        const h = store.getState().history.present.house;
        const o = g.type === 'door' ? h.doors.find((d) => d.id === g.id) : h.windows.find((d) => d.id === g.id);
        const w = o && h.walls.find((x) => x.id === o.wallId);
        if (!o || !w) return;
        const fr = wallFrame(w);
        const p = toWorld(e.clientX, e.clientY);
        let offset = dot(sub(p, w.a), fr.u) - g.grab;
        if (sn.grid && !free) offset = snapToGrid(offset, sn.gridSize);
        offset = round1(Math.max(0, Math.min(fr.length - o.width, offset)));
        if (g.type === 'door') actions.updateDoor(g.id, { offset });
        else actions.updateWindow(g.id, { offset });
        return;
      }
      case 'pinch': {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const r = svgRef.current!.getBoundingClientRect();
        const { w, h } = sizeRef.current;
        const s = clampScale(g.cam.s * (dist / g.dist));
        const wx = g.cam.cx + (g.mid.x - r.left - w / 2) / g.cam.s;
        const wy = g.cam.cy + (g.mid.y - r.top - h / 2) / g.cam.s;
        setCam({ cx: wx - (mid.x - r.left - w / 2) / s, cy: wy - (mid.y - r.top - h / 2) / s, s });
        return;
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === 'pan' && !g.moved && e.button !== 1) {
      // 빈 곳 클릭은 선택 해제
      if (!hitOf(e.target) && !(e.target as Element).closest('[data-fid]')) actions.select(null);
    }
    endEdit();
    if (pointers.current.size === 1 && g.kind === 'pinch') {
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: 'pan', startX: p.x, startY: p.y, cam: camRef.current!, moved: true };
    } else if (pointers.current.size === 0) {
      gesture.current = { kind: 'none' };
    }
  }

  function onDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('text/x-preset')) e.preventDefault();
  }
  function onDrop(e: DragEvent) {
    const id = e.dataTransfer?.getData('text/x-preset');
    if (!id || !camRef.current) return;
    e.preventDefault();
    const preset = [...BUILTIN_PRESETS, ...store.getState().history.present.userPresets].find((p) => p.id === id);
    if (preset) {
      const p = toWorld(e.clientX, e.clientY);
      actions.addFromPreset(preset, { x: round1(p.x), y: round1(p.y) });
    }
  }

  const viewBox = cam
    ? `${cam.cx - size.w / 2 / cam.s} ${cam.cy - size.h / 2 / cam.s} ${size.w / cam.s} ${size.h / cam.s}`
    : '0 0 100 100';
  const px = cam ? 1 / cam.s : 1;
  const structure = mode === 'structure';

  const bounds = useMemo(() => houseBounds(house), [house]);
  const distances = useMemo(
    () => (selected && !structure ? distancesToWalls(selected, house) : []),
    [selected, house, structure],
  );

  return (
    <div class={`plan2d mode-${mode}`}>
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
            <Grid bounds={bounds} s={cam.s} gridSize={gridSize} />
            <HouseShapes house={house} px={px} selection={structure ? selection : null} />
            <g class="furniture-layer">
              {furniture.map((f) => (
                <FurnitureItem key={f.id} f={f} selected={!structure && selected?.id === f.id} />
              ))}
              {!structure &&
                furniture.map((f) => (
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
            </g>
            {distances.map(
              (d) =>
                d.distance >= 1 && (
                  <g key={d.side} class="dim">
                    <line x1={d.from.x} y1={d.from.y} x2={d.to.x} y2={d.to.y} />
                    <DimText x={(d.from.x + d.to.x) / 2} y={(d.from.y + d.to.y) / 2} px={px} text={formatCm(d.distance)} />
                  </g>
                ),
            )}
            {structure && <StructureOverlay house={house} selection={selection} px={px} />}
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
