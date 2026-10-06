// 오른쪽 패널: 선택한 가구의 속성을 숫자로 정밀 편집.

import { describeIssue } from '../logic/collision';
import { SHAPE_LABELS } from '../model/presets';
import type { ShapeKind } from '../model/types';
import { actions, store, useApp } from '../store';
import { selectCollisions, selectFurnitureList, selectSelectedFurniture } from '../store/selectors';
import { NumberField } from './NumberField';

export function PropertiesPanel() {
  const f = useApp(selectSelectedFurniture);
  const readOnly = useApp((s) => s.ui.readOnly);
  const issues = useApp((s) => (f ? selectCollisions(s).get(f.id) : undefined));
  const nameOf = (id: string) => {
    const s = store.getState();
    return (
      selectFurnitureList(s).find((x) => x.id === id)?.name ??
      s.history.present.house.fixtures.find((x) => x.id === id)?.name
    );
  };

  if (!f) {
    return (
      <aside class="panel props">
        <h3>속성</h3>
        <p class="hint">평면도에서 가구를 클릭하면 여기서 치수와 위치를 숫자로 고칠 수 있습니다.</p>
        <ul class="hint shortcuts">
          <li>
            <kbd>드래그</kbd> 이동 (<kbd>Alt</kbd> 누르면 스냅 끔)
          </li>
          <li>
            <kbd>R</kbd> / <kbd>Shift+R</kbd> 90° 회전
          </li>
          <li>
            <kbd>방향키</kbd> 그리드만큼 이동 (<kbd>Shift</kbd> 1cm)
          </li>
          <li>
            <kbd>Ctrl+D</kbd> 복제, <kbd>Delete</kbd> 삭제
          </li>
          <li>
            <kbd>Ctrl+Z</kbd> 되돌리기, <kbd>Ctrl+Y</kbd> 다시 실행
          </li>
          <li>빈 곳 드래그로 화면 이동, 휠로 확대·축소</li>
        </ul>
      </aside>
    );
  }

  const update = (patch: Parameters<typeof actions.updateFurniture>[1]) => actions.updateFurniture(f.id, patch);

  // key로 가구마다 입력칸을 새로 만들어, 편집 중이던 값이 다른 가구에 들어가지 않게 한다
  return (
    <aside class="panel props" key={f.id}>
      <h3>속성</h3>
      {issues && (
        <ul class="issues">
          {issues.map((i, k) => (
            <li key={k}>⚠ {describeIssue(i, nameOf)}</li>
          ))}
        </ul>
      )}
      <label class="field">
        <span class="field-label">이름</span>
        <input
          value={f.name}
          disabled={readOnly}
          onChange={(e) => {
            const name = e.currentTarget.value.trim();
            if (name) update({ name });
          }}
        />
      </label>
      <label class="field">
        <span class="field-label">형태</span>
        <select
          value={f.shape}
          disabled={readOnly}
          onChange={(e) => update({ shape: e.currentTarget.value as ShapeKind })}
        >
          {Object.entries(SHAPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div class="field-group">
        <NumberField label="가로" value={f.width} min={1} disabled={readOnly} onCommit={(width) => update({ width })} />
        <NumberField label="세로" value={f.depth} min={1} disabled={readOnly} onCommit={(depth) => update({ depth })} />
        <NumberField label="높이" value={f.height} min={1} disabled={readOnly} onCommit={(height) => update({ height })} />
      </div>

      <div class="field-group">
        <NumberField label="X" value={f.x} disabled={readOnly} onCommit={(x) => update({ x })} />
        <NumberField label="Y" value={f.y} disabled={readOnly} onCommit={(y) => update({ y })} />
      </div>

      <div class="field-group">
        <NumberField
          label="회전"
          unit="°"
          value={f.rotation}
          disabled={readOnly}
          onCommit={(rotation) => update({ rotation })}
        />
        <div class="row">
          <button disabled={readOnly} onClick={() => actions.rotateFurniture(f.id, -90)} title="반시계 90° (Shift+R)">
            ⟲ 90°
          </button>
          <button disabled={readOnly} onClick={() => actions.rotateFurniture(f.id, 90)} title="시계 90° (R)">
            ⟳ 90°
          </button>
        </div>
      </div>

      <label class="field">
        <span class="field-label">색</span>
        <input
          type="color"
          value={f.color}
          disabled={readOnly}
          // input 이벤트마다 기록하면 색을 고르는 동안 Undo가 수십 개 쌓이므로 change에서만 반영
          onChange={(e) => update({ color: e.currentTarget.value })}
        />
      </label>

      {!readOnly && (
        <div class="actions-col">
          <button onClick={() => actions.duplicateFurniture(f.id)}>복제 (Ctrl+D)</button>
          <button
            onClick={() => {
              const name = prompt('프리셋 이름', f.name);
              if (name !== null) actions.saveAsPreset(f.id, name);
            }}
          >
            내 프리셋으로 저장
          </button>
          <button class="danger" onClick={() => actions.deleteFurniture(f.id)}>
            삭제 (Delete)
          </button>
        </div>
      )}
    </aside>
  );
}
