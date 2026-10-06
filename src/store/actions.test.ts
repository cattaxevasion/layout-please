import { describe, expect, it } from 'vitest';
import { findFurniture, getActiveLayout } from '../model/ops';
import { BUILTIN_PRESETS } from '../model/presets';
import { createSampleDoc } from '../model/sample';
import { createActions } from './actions';
import { createAppState } from './appState';
import { createStore } from './createStore';

function setup(readOnly = false) {
  const store = createStore(createAppState(createSampleDoc(), { readOnly }));
  const actions = createActions(store);
  const doc = () => store.getState().history.present;
  const firstId = getActiveLayout(doc()).furniture[0].id;
  return { store, actions, doc, firstId };
}

describe('actions', () => {
  it('드래그는 Undo 한 번으로 원위치', () => {
    const { store, actions, doc, firstId } = setup();
    const start = findFurniture(doc(), firstId)!;
    actions.beginGesture();
    for (let i = 1; i <= 20; i++) actions.moveFurniture(firstId, start.x + i, start.y);
    actions.endGesture();
    expect(store.getState().history.past).toHaveLength(1);
    actions.undo();
    expect(findFurniture(doc(), firstId)!.x).toBe(start.x);
  });

  it('추가하면 선택되고, Undo로 사라지면 선택도 해제', () => {
    const { store, actions } = setup();
    actions.addFromPreset(BUILTIN_PRESETS[0], { x: 100, y: 100 });
    expect(store.getState().ui.selection?.kind).toBe('furniture');
    actions.undo();
    expect(store.getState().ui.selection).toBeNull();
  });

  it('배치안 전환은 Undo 기록을 남기지 않는다', () => {
    const { store, actions, doc } = setup();
    actions.setActiveLayout(doc().layouts[1].id);
    expect(doc().activeLayoutId).toBe(doc().layouts[1].id);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('90도 회전', () => {
    const { actions, doc, firstId } = setup();
    const before = findFurniture(doc(), firstId)!.rotation;
    actions.rotateFurniture(firstId, 90);
    expect(findFurniture(doc(), firstId)!.rotation).toBe((before + 90) % 360);
  });

  it('열람 모드에서는 수정되지 않는다', () => {
    const { actions, doc, firstId } = setup(true);
    const before = doc();
    actions.moveFurniture(firstId, 0, 0);
    actions.deleteFurniture(firstId);
    expect(doc()).toBe(before);
  });
});
