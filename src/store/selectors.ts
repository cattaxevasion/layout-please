import { checkLayout } from '../logic/collision';
import { getActiveLayout } from '../model/ops';
import type { CollisionMap, Furniture, House } from '../model/types';
import type { AppState } from './appState';

export const selectDoc = (s: AppState) => s.history.present;
export const selectHouse = (s: AppState) => s.history.present.house;
export const selectActiveLayout = (s: AppState) => getActiveLayout(s.history.present);
export const selectFurnitureList = (s: AppState) => selectActiveLayout(s).furniture;
export const selectCanUndo = (s: AppState) => s.history.past.length > 0;
export const selectCanRedo = (s: AppState) => s.history.future.length > 0;

export function selectSelectedFurniture(s: AppState): Furniture | null {
  const sel = s.ui.selection;
  if (sel?.kind !== 'furniture') return null;
  return selectFurnitureList(s).find((f) => f.id === sel.id) ?? null;
}

let collisionMemo: { house: House; list: readonly Furniture[]; result: CollisionMap } | null = null;

/** 충돌 결과. 집 구조나 가구 목록이 바뀔 때만 다시 계산한다. */
export function selectCollisions(s: AppState): CollisionMap {
  const house = s.history.present.house;
  const list = selectFurnitureList(s);
  if (collisionMemo && collisionMemo.house === house && collisionMemo.list === list) return collisionMemo.result;
  const result = checkLayout(house, list);
  collisionMemo = { house, list, result };
  return result;
}
