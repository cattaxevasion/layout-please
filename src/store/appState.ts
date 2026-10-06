import type { ProjectDoc, UiState } from '../model/types';
import { initHistory, type History } from './history';

export interface AppState {
  history: History<ProjectDoc>;
  ui: UiState;
}

export function createInitialUi(): UiState {
  return {
    mode: 'arrange',
    view: 'split',
    selection: null,
    snap: { grid: true, gridSize: 5, walls: true, furniture: true, threshold: 8 },
    walls3d: 'auto',
    readOnly: false,
    notice: null,
  };
}

export function createAppState(doc: ProjectDoc, ui: Partial<UiState> = {}): AppState {
  return { history: initHistory(doc), ui: { ...createInitialUi(), ...ui } };
}
