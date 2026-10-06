import { getActiveLayout } from '../model/ops';
import type { Furniture } from '../model/types';
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
