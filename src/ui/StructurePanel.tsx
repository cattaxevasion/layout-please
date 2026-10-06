// 구조 편집 모드의 패널: 왼쪽은 추가 도구와 방 목록, 오른쪽은 선택한 구조물의 숫자 편집.

import { formatCm } from '../logic/measure';
import { wallFrame } from '../logic/openings';
import * as st from '../model/structure';
import type { Door, DoorType, Fixture, House, HouseWindow, Room, Selection, Wall } from '../model/types';
import { actions, store, useApp } from '../store';
import { getViewCenter } from '../view2d/viewApi';
import { NumberField } from './NumberField';

const center = () => getViewCenter() ?? { x: 0, y: 0 };

export function StructureTools() {
  const house = useApp((s) => s.history.present.house);
  const selection = useApp((s) => s.ui.selection);
  return (
    <aside class="panel palette">
      <h3>구조 추가</h3>
      <div class="actions-col tight">
        <button onClick={() => actions.addStructure('room', (h) => st.addRectRoom(h, center()))}>
          + 방 (직사각형)
        </button>
        <button
          onClick={() =>
            actions.addStructure('wall', (h) => {
              const c = center();
              return st.addWall(h, { x: Math.round(c.x - 100), y: Math.round(c.y) }, { x: Math.round(c.x + 100), y: Math.round(c.y) });
            })
          }
        >
          + 벽
        </button>
        <button onClick={() => actions.addStructure('fixture', (h) => st.addFixture(h, center()))}>
          + 붙박이 설비
        </button>
      </div>
      <p class="hint">문과 창은 벽을 선택한 뒤 오른쪽 패널에서 추가합니다.</p>

      <h3>방</h3>
      <div class="preset-list">
        {house.rooms.map((r) => (
          <div
            key={r.id}
            class={`preset${selection?.kind === 'room' && selection.id === r.id ? ' active' : ''}`}
            onClick={() => actions.select({ kind: 'room', id: r.id })}
          >
            <span class="swatch" style={{ background: r.floorColor }} />
            <span class="preset-name">{r.name}</span>
            <span class="preset-size">꼭짓점 {r.points.length}</span>
          </div>
        ))}
      </div>

      <h3>집</h3>
      <NumberField label="천장" value={house.ceilingHeight} min={100} onCommit={actions.setCeilingHeight} />

      <h3>사용법</h3>
      <ul class="hint shortcuts">
        <li>방을 클릭하면 꼭짓점(●)을 끌어 모양을 바꿀 수 있습니다. 변 가운데 ⊕를 누르면 꼭짓점이 추가됩니다.</li>
        <li>방 모양을 바꾸면 그 방의 벽이 자동으로 따라옵니다 (두께 유지).</li>
        <li>문·창은 끌어서 벽을 따라 옮깁니다.</li>
        <li>
          <kbd>Alt</kbd>를 누르고 끌면 스냅을 끕니다.
        </li>
      </ul>
    </aside>
  );
}

export function StructurePanel() {
  const house = useApp((s) => s.history.present.house);
  const selection = useApp((s) => s.ui.selection);
  return (
    <aside class="panel props" key={selection ? `${selection.kind}:${selection.id}` : 'none'}>
      <StructureEditor house={house} selection={selection} />
    </aside>
  );
}

function StructureEditor({ house, selection }: { house: House; selection: Selection | null }) {
  if (!selection || selection.kind === 'furniture') {
    return (
      <>
        <h3>구조 편집</h3>
        <p class="hint">
          방, 벽, 문, 창, 붙박이 설비를 클릭하면 여기서 치수를 숫자로 고칠 수 있습니다. 가구는 이 모드에서 잠겨 있습니다.
        </p>
      </>
    );
  }
  switch (selection.kind) {
    case 'room': {
      const r = house.rooms.find((x) => x.id === selection.id);
      return r ? <RoomEditor room={r} vertex={selection.vertex} /> : null;
    }
    case 'wall': {
      const w = house.walls.find((x) => x.id === selection.id);
      return w ? <WallEditor wall={w} house={house} /> : null;
    }
    case 'door': {
      const d = house.doors.find((x) => x.id === selection.id);
      return d ? <DoorEditor door={d} /> : null;
    }
    case 'window': {
      const d = house.windows.find((x) => x.id === selection.id);
      return d ? <WindowEditor win={d} /> : null;
    }
    case 'fixture': {
      const f = house.fixtures.find((x) => x.id === selection.id);
      return f ? <FixtureEditor f={f} /> : null;
    }
  }
}

function RoomEditor({ room, vertex }: { room: Room; vertex?: number }) {
  return (
    <>
      <h3>방</h3>
      <label class="field">
        <span class="field-label">이름</span>
        <input
          value={room.name}
          onChange={(e) => {
            const name = e.currentTarget.value.trim();
            if (name) actions.updateRoom(room.id, { name });
          }}
        />
      </label>
      <label class="field">
        <span class="field-label">바닥</span>
        <input type="color" value={room.floorColor} onChange={(e) => actions.updateRoom(room.id, { floorColor: e.currentTarget.value })} />
      </label>

      <h3>꼭짓점 (cm)</h3>
      <table class="vertex-table">
        <tbody>
          {room.points.map((p, i) => (
            <tr
              key={i}
              class={vertex === i ? 'active' : ''}
              onClick={() => actions.select({ kind: 'room', id: room.id, vertex: i })}
            >
              <td class="muted">{i + 1}</td>
              <td>
                <NumberField label="X" unit="" value={p.x} onCommit={(x) => actions.moveVertex(room.id, i, { x, y: p.y })} />
              </td>
              <td>
                <NumberField label="Y" unit="" value={p.y} onCommit={(y) => actions.moveVertex(room.id, i, { x: p.x, y })} />
              </td>
              <td>
                <button
                  class="icon"
                  title="꼭짓점 삭제"
                  disabled={room.points.length <= 3}
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.removeVertex(room.id, i);
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div class="actions-col">
        <button onClick={() => actions.insertVertex(room.id, vertex ?? room.points.length - 1)}>
          {vertex !== undefined ? `${vertex + 1}번 다음에 꼭짓점 추가` : '마지막에 꼭짓점 추가'}
        </button>
        <button onClick={() => actions.regenerateRoomWalls(room.id)}>둘레 벽 다시 만들기</button>
        <button
          class="danger"
          onClick={() => {
            if (confirm(`'${room.name}' 방과 딸린 벽을 삭제할까요?`)) actions.removeRoom(room.id);
          }}
        >
          방 삭제
        </button>
      </div>
    </>
  );
}

function WallEditor({ wall, house }: { wall: Wall; house: House }) {
  const len = wallFrame(wall).length;
  const room = wall.roomId ? house.rooms.find((r) => r.id === wall.roomId) : null;
  return (
    <>
      <h3>벽</h3>
      {room && <p class="hint">'{room.name}' 둘레 벽입니다. 끝점을 직접 옮기면 방과의 연결이 풀립니다.</p>}
      <div class="field-group">
        <NumberField label="시작X" value={wall.a.x} onCommit={(x) => actions.updateWall(wall.id, { a: { ...wall.a, x } })} />
        <NumberField label="시작Y" value={wall.a.y} onCommit={(y) => actions.updateWall(wall.id, { a: { ...wall.a, y } })} />
        <NumberField label="끝X" value={wall.b.x} onCommit={(x) => actions.updateWall(wall.id, { b: { ...wall.b, x } })} />
        <NumberField label="끝Y" value={wall.b.y} onCommit={(y) => actions.updateWall(wall.id, { b: { ...wall.b, y } })} />
      </div>
      <div class="field-group">
        <NumberField label="길이" value={len} min={1} onCommit={(v) => actions.setWallLength(wall.id, v)} />
        <NumberField label="두께" value={wall.thickness} min={1} onCommit={(thickness) => actions.updateWall(wall.id, { thickness })} />
      </div>
      <div class="actions-col">
        <button onClick={() => actions.addStructure('door', (h) => st.addDoor(h, wall.id))}>+ 이 벽에 문</button>
        <button onClick={() => actions.addStructure('window', (h) => st.addWindow(h, wall.id))}>+ 이 벽에 창</button>
        <button class="danger" onClick={() => actions.removeWall(wall.id)}>
          벽 삭제
        </button>
      </div>
    </>
  );
}

const DOOR_TYPES: [DoorType, string][] = [
  ['hinged', '여닫이'],
  ['sliding', '미닫이'],
  ['folding', '접이문'],
  ['opening', '문 없음 (개구부)'],
];

function wallLength(wallId: string) {
  const w = store.getState().history.present.house.walls.find((x) => x.id === wallId);
  return w ? wallFrame(w).length : Infinity;
}

function DoorEditor({ door }: { door: Door }) {
  const up = (patch: Partial<Door>) => actions.updateDoor(door.id, patch);
  const swings = door.type === 'hinged' || door.type === 'folding';
  const maxLen = wallLength(door.wallId);
  return (
    <>
      <h3>문</h3>
      <label class="field">
        <span class="field-label">종류</span>
        <select value={door.type} onChange={(e) => up({ type: e.currentTarget.value as DoorType })}>
          {DOOR_TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <div class="field-group">
        <NumberField
          label="위치"
          value={door.offset}
          min={0}
          onCommit={(offset) => up({ offset: Math.min(offset, Math.max(0, maxLen - door.width)) })}
        />
        <NumberField label="폭" value={door.width} min={10} onCommit={(width) => up({ width: Math.min(width, maxLen) })} />
        <NumberField label="높이" value={door.height} min={50} onCommit={(height) => up({ height })} />
      </div>
      <p class="hint">위치는 벽 시작점에서 문 시작까지의 거리입니다.</p>
      {swings && (
        <div class="field-group">
          <NumberField label="반경" value={door.swingRadius} min={10} onCommit={(swingRadius) => up({ swingRadius })} />
          <div class="row">
            <button onClick={() => up({ hinge: door.hinge === 'start' ? 'end' : 'start' })}>경첩 반대로</button>
            <button onClick={() => up({ side: door.side === 1 ? -1 : 1 })}>여는 쪽 반대로</button>
          </div>
        </div>
      )}
      <div class="actions-col">
        <button class="danger" onClick={() => actions.removeDoor(door.id)}>
          문 삭제
        </button>
      </div>
    </>
  );
}

function WindowEditor({ win }: { win: HouseWindow }) {
  const up = (patch: Partial<HouseWindow>) => actions.updateWindow(win.id, patch);
  const maxLen = wallLength(win.wallId);
  return (
    <>
      <h3>창문</h3>
      <div class="field-group">
        <NumberField
          label="위치"
          value={win.offset}
          min={0}
          onCommit={(offset) => up({ offset: Math.min(offset, Math.max(0, maxLen - win.width)) })}
        />
        <NumberField label="폭" value={win.width} min={10} onCommit={(width) => up({ width: Math.min(width, maxLen) })} />
        <NumberField label="창턱" value={win.sillHeight} min={0} onCommit={(sillHeight) => up({ sillHeight })} />
        <NumberField label="창높이" value={win.height} min={10} onCommit={(height) => up({ height })} />
      </div>
      <p class="hint">
        위치는 벽 시작점에서 창 시작까지, 창턱은 바닥에서 창 아래까지의 높이입니다. 창 위쪽 높이:{' '}
        {formatCm(win.sillHeight + win.height)}cm
      </p>
      <div class="actions-col">
        <button class="danger" onClick={() => actions.removeWindow(win.id)}>
          창 삭제
        </button>
      </div>
    </>
  );
}

function FixtureEditor({ f }: { f: Fixture }) {
  const up = (patch: Partial<Fixture>) => actions.updateFixture(f.id, patch);
  return (
    <>
      <h3>붙박이 설비</h3>
      <label class="field">
        <span class="field-label">이름</span>
        <input
          value={f.name}
          onChange={(e) => {
            const name = e.currentTarget.value.trim();
            if (name) up({ name });
          }}
        />
      </label>
      <div class="field-group">
        <NumberField label="가로" value={f.width} min={1} onCommit={(width) => up({ width })} />
        <NumberField label="세로" value={f.depth} min={1} onCommit={(depth) => up({ depth })} />
        <NumberField label="높이" value={f.height} min={1} onCommit={(height) => up({ height })} />
      </div>
      <div class="field-group">
        <NumberField label="X" value={f.x} onCommit={(x) => up({ x })} />
        <NumberField label="Y" value={f.y} onCommit={(y) => up({ y })} />
        <NumberField label="회전" unit="°" value={f.rotation} onCommit={(rotation) => up({ rotation })} />
        <div class="row">
          <button onClick={() => up({ rotation: f.rotation - 90 })}>⟲ 90°</button>
          <button onClick={() => up({ rotation: f.rotation + 90 })}>⟳ 90°</button>
        </div>
      </div>
      <label class="field">
        <span class="field-label">색</span>
        <input type="color" value={f.color} onChange={(e) => up({ color: e.currentTarget.value })} />
      </label>
      <div class="actions-col">
        <button class="danger" onClick={() => actions.removeFixture(f.id)}>
          설비 삭제
        </button>
      </div>
    </>
  );
}
