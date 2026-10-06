// 앱 전역 store. 시작할 때 공유 링크(#s=...) → 저장된 문서 → 샘플 순으로 문서를 고른다.
// 테스트는 createStore/createActions로 따로 만든다.

import { parseShareHash } from '../logic/share';
import { docFromShare } from '../logic/serialize';
import { createSampleDoc } from '../model/sample';
import type { SharePayload } from '../model/types';
import { createActions } from './actions';
import { createAppState } from './appState';
import type { AppState } from './appState';
import { createStore } from './createStore';
import { loadDoc, loadUiPrefs, safeStorage, startAutoSave } from './persistence';
import { useStore } from './useStore';

export const storage = safeStorage();

let shared: SharePayload | null = null;
let shareError: string | null = null;
try {
  shared = parseShareHash(location.hash);
} catch (e) {
  shareError = e instanceof Error ? e.message : String(e);
}

const loaded = loadDoc(storage);

/** 열람 중인 공유 데이터 (없으면 null) */
export const sharedPayload = shared;

export const store = createStore(
  createAppState(shared ? docFromShare(shared) : (loaded.doc ?? createSampleDoc()), {
    ...loadUiPrefs(storage),
    readOnly: !!shared,
    notice: shareError ?? loaded.error ?? (storage ? null : '이 브라우저에서는 자동 저장을 쓸 수 없습니다.'),
  }),
);
export const actions = createActions(store);

startAutoSave(store, storage, (msg) => actions.notify(msg));

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(store, selector);
}
