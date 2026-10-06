import { render } from 'preact';
import { actions, store } from './store';
import { selectSelectedFurniture } from './store/selectors';
import { App } from './ui/App';
import './ui/styles.css';

// 전역 단축키. 입력칸에 포커스가 있을 때는 브라우저 기본 동작(글자 입력·되돌리기)을 그대로 둔다.
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
    return;
  }
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  if (mod && key === 'z' && !e.shiftKey) {
    e.preventDefault();
    actions.undo();
    return;
  }
  if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
    e.preventDefault();
    actions.redo();
    return;
  }

  const state = store.getState();
  const f = selectSelectedFurniture(state);
  if (key === 'escape') {
    actions.select(null);
    return;
  }
  const sel = state.ui.selection;
  if (!f && sel && (key === 'delete' || key === 'backspace') && !state.ui.readOnly) {
    e.preventDefault();
    if (sel.kind === 'room' && sel.vertex !== undefined) actions.removeVertex(sel.id, sel.vertex);
    else if (sel.kind === 'wall') actions.removeWall(sel.id);
    else if (sel.kind === 'door') actions.removeDoor(sel.id);
    else if (sel.kind === 'window') actions.removeWindow(sel.id);
    else if (sel.kind === 'fixture') actions.removeFixture(sel.id);
    return;
  }
  if (!f) return;

  if (mod && key === 'd') {
    e.preventDefault();
    actions.duplicateFurniture(f.id);
  } else if (!mod && key === 'r') {
    actions.rotateFurniture(f.id, e.shiftKey ? -90 : 90);
  } else if (key === 'delete' || key === 'backspace') {
    e.preventDefault();
    actions.deleteFurniture(f.id);
  } else if (key.startsWith('arrow')) {
    e.preventDefault();
    const step = e.shiftKey ? 1 : state.ui.snap.grid ? state.ui.snap.gridSize : 5;
    const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
    const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
    actions.moveFurniture(f.id, f.x + dx, f.y + dy);
  }
});

render(<App />, document.getElementById('app')!);
