// 뷰(2D/3D/패널)는 store를 직접 바꾸지 않고 여기의 액션만 호출한다.

import * as ops from '../model/ops';
import { furnitureFromPreset } from '../model/presets';
import type {
  FurniturePreset,
  House,
  Id,
  ProjectDoc,
  Selection,
  SnapSettings,
  UiState,
} from '../model/types';
import type { AppState } from './appState';
import type { Store } from './createStore';
import * as hist from './history';

export function createActions(store: Store<AppState>) {
  /** 드래그 등 진행 중인 동작의 시작 시점 문서 */
  let gestureBase: ProjectDoc | null = null;

  const doc = () => store.getState().history.present;

  /** 문서를 바꾼다. 진행 중인 동작이 있으면 기록하지 않고 끝날 때 한 번에 기록한다. */
  function commit(fn: (d: ProjectDoc) => ProjectDoc) {
    store.setState((s) => {
      const next = fn(s.history.present);
      if (next === s.history.present) return s;
      const history = gestureBase
        ? hist.replacePresent(s.history, next)
        : hist.pushHistory(s.history, next);
      return withValidSelection({ ...s, history });
    });
  }

  /** Undo 기록 없이 문서를 바꾼다. */
  function silent(fn: (d: ProjectDoc) => ProjectDoc) {
    store.setState((s) => {
      const next = fn(s.history.present);
      if (next === s.history.present) return s;
      return withValidSelection({ ...s, history: hist.replacePresent(s.history, next) });
    });
  }

  function setUi(patch: Partial<UiState>) {
    store.setState((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
  }

  function guardReadOnly(): boolean {
    return store.getState().ui.readOnly;
  }

  const actions = {
    // ───────── 기록 ─────────
    beginGesture() {
      if (!gestureBase) gestureBase = doc();
    },
    endGesture() {
      if (!gestureBase) return;
      const base = gestureBase;
      gestureBase = null;
      store.setState((s) => ({ ...s, history: hist.commitGesture(s.history, base) }));
    },
    undo() {
      actions.endGesture();
      store.setState((s) => withValidSelection({ ...s, history: hist.undo(s.history) }));
    },
    redo() {
      actions.endGesture();
      store.setState((s) => withValidSelection({ ...s, history: hist.redo(s.history) }));
    },

    // ───────── UI ─────────
    select(selection: Selection | null) {
      setUi({ selection });
    },
    setMode(mode: UiState['mode']) {
      setUi({ mode, selection: null });
    },
    setView(view: UiState['view']) {
      setUi({ view });
    },
    setSnap(patch: Partial<SnapSettings>) {
      setUi({ snap: { ...store.getState().ui.snap, ...patch } });
    },
    setWalls3d(walls3d: UiState['walls3d']) {
      setUi({ walls3d });
    },

    // ───────── 가구 ─────────
    addFromPreset(preset: FurniturePreset, at: { x: number; y: number }) {
      if (guardReadOnly()) return;
      const f = furnitureFromPreset(preset, at);
      commit((d) => ops.addFurniture(d, f));
      setUi({ selection: { kind: 'furniture', id: f.id } });
    },
    updateFurniture(id: Id, patch: ops.FurniturePatch) {
      if (guardReadOnly()) return;
      commit((d) => ops.updateFurniture(d, id, patch));
    },
    moveFurniture(id: Id, x: number, y: number) {
      actions.updateFurniture(id, { x, y });
    },
    rotateFurniture(id: Id, delta: number) {
      const f = ops.findFurniture(doc(), id);
      if (f) actions.updateFurniture(id, { rotation: f.rotation + delta });
    },
    duplicateFurniture(id: Id) {
      if (guardReadOnly()) return;
      const r = ops.duplicateFurniture(doc(), id);
      if (!r.newId) return;
      commit(() => r.doc);
      setUi({ selection: { kind: 'furniture', id: r.newId } });
    },
    deleteFurniture(id: Id) {
      if (guardReadOnly()) return;
      commit((d) => ops.removeFurniture(d, id));
    },

    // ───────── 배치안 ─────────
    /** 배치안 전환은 Undo 기록을 남기지 않는다. */
    setActiveLayout(id: Id) {
      silent((d) => ops.setActiveLayout(d, id));
      setUi({ selection: null });
    },
    addLayout() {
      if (guardReadOnly()) return;
      commit((d) => ops.addLayout(d));
    },
    duplicateLayout(id: Id) {
      if (guardReadOnly()) return;
      commit((d) => ops.duplicateLayout(d, id));
    },
    renameLayout(id: Id, name: string) {
      if (guardReadOnly()) return;
      commit((d) => ops.renameLayout(d, id, name));
    },
    deleteLayout(id: Id) {
      if (guardReadOnly()) return;
      commit((d) => ops.deleteLayout(d, id));
    },

    // ───────── 사용자 프리셋 ─────────
    saveAsPreset(furnitureId: Id, name?: string) {
      if (guardReadOnly()) return;
      commit((d) => ops.saveFurnitureAsPreset(d, furnitureId, name));
    },
    deletePreset(id: Id) {
      if (guardReadOnly()) return;
      commit((d) => ops.deleteUserPreset(d, id));
    },

    // ───────── 구조 ─────────
    updateHouse(fn: (h: House) => House) {
      if (guardReadOnly()) return;
      commit((d) => ops.updateHouse(d, fn));
    },

    // ───────── 문서 전체 ─────────
    /** 불러오기 등으로 문서를 통째로 바꾼다. Undo로 되돌릴 수 있다. */
    replaceDoc(next: ProjectDoc) {
      commit(() => next);
      setUi({ selection: null });
    },
  };
  return actions;
}

export type Actions = ReturnType<typeof createActions>;

/** Undo 등으로 선택한 가구가 사라졌으면 선택을 해제한다. */
function withValidSelection(s: AppState): AppState {
  const sel = s.ui.selection;
  if (sel?.kind !== 'furniture') return s;
  const exists = ops.getActiveLayout(s.history.present).furniture.some((f) => f.id === sel.id);
  return exists ? s : { ...s, ui: { ...s.ui, selection: null } };
}
