// 구조 편집 모드에서 선택한 방/벽 위에 그리는 손잡이와 치수.

import { signedArea } from '../geometry/polygon';
import { dist, lerp, leftNormal, normalize, scale, sub, add } from '../geometry/vec';
import { formatCm } from '../logic/measure';
import type { House, Selection } from '../model/types';
import { DimText, ptsAttr } from './HouseShapes';

export function StructureOverlay({ house, selection, px }: { house: House; selection: Selection | null; px: number }) {
  if (selection?.kind === 'room') {
    const room = house.rooms.find((r) => r.id === selection.id);
    if (!room) return null;
    const pts = room.points;
    // 치수 글자는 방 안쪽에 둔다 (시계방향 기준 안쪽 = 진행방향 오른쪽)
    const cw = signedArea(pts) > 0;
    return (
      <g class="structure-overlay">
        <polygon points={ptsAttr(pts)} class="room-outline" />
        {pts.map((p, i) => {
          const q = pts[(i + 1) % pts.length];
          const m = lerp(p, q, 0.5);
          const inward = scale(leftNormal(normalize(sub(q, p))), cw ? -1 : 1);
          const t = add(m, scale(inward, 14 * px));
          return (
            <g key={`e${i}`}>
              <DimText x={t.x} y={t.y} px={px} text={formatCm(dist(p, q))} />
              <g data-hit="insert" data-id={room.id} data-index={i} class="insert-handle">
                <circle cx={m.x} cy={m.y} r={5 * px} />
                <path d={`M ${m.x - 3 * px} ${m.y} H ${m.x + 3 * px} M ${m.x} ${m.y - 3 * px} V ${m.y + 3 * px}`} />
              </g>
            </g>
          );
        })}
        {pts.map((p, i) => (
          <circle
            key={`v${i}`}
            cx={p.x}
            cy={p.y}
            r={6 * px}
            class={`vertex-handle${selection.vertex === i ? ' active' : ''}`}
            data-hit="vertex"
            data-id={room.id}
            data-index={i}
          />
        ))}
      </g>
    );
  }
  if (selection?.kind === 'wall') {
    const w = house.walls.find((x) => x.id === selection.id);
    if (!w) return null;
    const m = lerp(w.a, w.b, 0.5);
    const off = scale(leftNormal(normalize(sub(w.b, w.a))), w.thickness / 2 + 12 * px);
    return (
      <g class="structure-overlay">
        <DimText x={m.x + off.x} y={m.y + off.y} px={px} text={formatCm(dist(w.a, w.b))} />
        {(['a', 'b'] as const).map((end) => (
          <circle
            key={end}
            cx={w[end].x}
            cy={w[end].y}
            r={6 * px}
            class="vertex-handle"
            data-hit="wallEnd"
            data-id={w.id}
            data-end={end}
          />
        ))}
      </g>
    );
  }
  return null;
}
