// 앱 전역에서 쓰는 store 인스턴스. 테스트는 createStore/createActions로 따로 만든다.

import { createSampleDoc } from '../model/sample';
import { createActions } from './actions';
import { createAppState } from './appState';
import { createStore } from './createStore';
import { useStore } from './useStore';
import type { AppState } from './appState';

export const store = createStore(createAppState(createSampleDoc()));
export const actions = createActions(store);

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(store, selector);
}
