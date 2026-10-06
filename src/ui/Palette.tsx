// 왼쪽 패널: 가구 추가 (프리셋 클릭 또는 평면도로 끌어다 놓기), 내 프리셋, 박스 가구 만들기.

import { useState } from 'preact/hooks';
import { formatCm } from '../logic/measure';
import { newId } from '../model/ids';
import { BUILTIN_PRESETS } from '../model/presets';
import type { FurniturePreset } from '../model/types';
import { actions, store, useApp } from '../store';
import { getViewCenter } from '../view2d/viewApi';
import { NumberField } from './NumberField';

function addAtCenter(p: FurniturePreset) {
  const fallback = store.getState().history.present.house.rooms[0]?.points[0] ?? { x: 0, y: 0 };
  const c = getViewCenter() ?? fallback;
  actions.addFromPreset(p, { x: Math.round(c.x), y: Math.round(c.y) });
}

function PresetButton({ p, onDelete }: { p: FurniturePreset; onDelete?: () => void }) {
  return (
    <div
      class="preset"
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData('text/x-preset', p.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => addAtCenter(p)}
      title="클릭하면 화면 가운데에 추가, 평면도로 끌어다 놓을 수도 있습니다"
    >
      <span class="swatch" style={{ background: p.color }} />
      <span class="preset-name">{p.name}</span>
      <span class="preset-size">
        {formatCm(p.width)}×{formatCm(p.depth)}
      </span>
      {onDelete && (
        <button
          class="icon"
          title="내 프리셋에서 삭제"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`'${p.name}' 프리셋을 삭제할까요?`)) onDelete();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function Palette() {
  const userPresets = useApp((s) => s.history.present.userPresets);
  const readOnly = useApp((s) => s.ui.readOnly);
  const [box, setBox] = useState({ name: '박스', width: 60, depth: 40, height: 80 });

  if (readOnly) return null;

  return (
    <aside class="panel palette">
      <h3>가구 추가</h3>
      <div class="preset-list">
        {BUILTIN_PRESETS.map((p) => (
          <PresetButton key={p.id} p={p} />
        ))}
      </div>

      <h3>내 프리셋</h3>
      {userPresets.length === 0 ? (
        <p class="hint">가구를 선택한 뒤 오른쪽 패널의 '내 프리셋으로 저장'을 누르면 여기에 생깁니다.</p>
      ) : (
        <div class="preset-list">
          {userPresets.map((p) => (
            <PresetButton key={p.id} p={p} onDelete={() => actions.deletePreset(p.id)} />
          ))}
        </div>
      )}

      <h3>박스 가구 만들기</h3>
      <div class="box-form">
        <label class="field">
          <span class="field-label">이름</span>
          <input value={box.name} onInput={(e) => setBox({ ...box, name: e.currentTarget.value })} />
        </label>
        <NumberField label="가로" value={box.width} min={1} onCommit={(width) => setBox({ ...box, width })} />
        <NumberField label="세로" value={box.depth} min={1} onCommit={(depth) => setBox({ ...box, depth })} />
        <NumberField label="높이" value={box.height} min={1} onCommit={(height) => setBox({ ...box, height })} />
        <button
          class="primary"
          onClick={() =>
            addAtCenter({
              id: newId('p'),
              name: box.name.trim() || '박스',
              shape: 'box',
              width: box.width,
              depth: box.depth,
              height: box.height,
              color: '#9aa5b1',
              builtin: false,
            })
          }
        >
          추가
        </button>
      </div>
    </aside>
  );
}
