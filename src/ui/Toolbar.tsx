import type { UiState } from '../model/types';
import { actions, useApp } from '../store';
import { selectActiveLayout, selectCanRedo, selectCanUndo, selectDoc } from '../store/selectors';

const VIEWS: [UiState['view'], string][] = [
  ['split', '2D + 3D'],
  ['2d', '2D'],
  ['3d', '3D'],
];

export function Toolbar() {
  const canUndo = useApp(selectCanUndo);
  const canRedo = useApp(selectCanRedo);
  const view = useApp((s) => s.ui.view);
  const snap = useApp((s) => s.ui.snap);

  return (
    <header class="toolbar">
      <strong class="app-title">가구 배치</strong>
      <LayoutTabs />
      <div class="toolbar-group">
        <button onClick={actions.undo} disabled={!canUndo} title="되돌리기 (Ctrl+Z)">
          ↶ 되돌리기
        </button>
        <button onClick={actions.redo} disabled={!canRedo} title="다시 실행 (Ctrl+Y)">
          ↷ 다시 실행
        </button>
      </div>
      <div class="toolbar-group snap">
        <span class="muted">스냅</span>
        <label>
          <input type="checkbox" checked={snap.grid} onChange={(e) => actions.setSnap({ grid: e.currentTarget.checked })} />
          그리드
        </label>
        <select
          value={snap.gridSize}
          disabled={!snap.grid}
          onChange={(e) => actions.setSnap({ gridSize: Number(e.currentTarget.value) })}
          title="그리드 간격"
        >
          {[1, 5, 10, 25, 50].map((g) => (
            <option key={g} value={g}>
              {g}cm
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={snap.walls} onChange={(e) => actions.setSnap({ walls: e.currentTarget.checked })} />
          벽
        </label>
        <label>
          <input
            type="checkbox"
            checked={snap.furniture}
            onChange={(e) => actions.setSnap({ furniture: e.currentTarget.checked })}
          />
          가구
        </label>
      </div>
      <div class="toolbar-group segmented">
        {VIEWS.map(([v, label]) => (
          <button key={v} class={view === v ? 'active' : ''} onClick={() => actions.setView(v)}>
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}

function LayoutTabs() {
  const doc = useApp(selectDoc);
  const active = useApp(selectActiveLayout);
  return (
    <div class="toolbar-group layout-tabs">
      <select
        value={active.id}
        onChange={(e) => actions.setActiveLayout(e.currentTarget.value)}
        title="배치안 선택"
      >
        {doc.layouts.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button onClick={() => actions.duplicateLayout(active.id)} title="현재 배치안을 복제">
        복제
      </button>
      <button
        onClick={() => {
          const name = prompt('배치안 이름', active.name);
          if (name) actions.renameLayout(active.id, name);
        }}
        title="이름 변경"
      >
        이름
      </button>
      <button onClick={() => actions.addLayout()} title="빈 배치안 추가">
        새 배치안
      </button>
      <button
        onClick={() => {
          if (confirm(`'${active.name}'을(를) 삭제할까요?`)) actions.deleteLayout(active.id);
        }}
        disabled={doc.layouts.length <= 1}
        title="현재 배치안 삭제"
      >
        삭제
      </button>
    </div>
  );
}
