// localStorage 자동 저장. 문서(집, 배치안, 사용자 프리셋)와 화면 설정을 따로 저장한다.

import { migrateDoc } from '../model/migrate';
import type { ProjectDoc, UiState } from '../model/types';
import type { AppState } from './appState';
import type { Store } from './createStore';

export const DOC_KEY = 'layout-please/doc';
export const UI_KEY = 'layout-please/ui';
/** 읽지 못한 옛 데이터를 버리지 않고 옮겨 두는 곳 */
export const BROKEN_KEY = 'layout-please/doc-broken';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 저장 대상 화면 설정 (모드·선택·열람 여부는 저장하지 않는다) */
export type UiPrefs = Pick<UiState, 'view' | 'snap' | 'walls3d'>;

export function safeStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const k = '__lp_test__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export interface LoadResult {
  doc: ProjectDoc | null;
  /** 저장된 데이터가 있었지만 읽지 못한 경우의 안내 문구 */
  error?: string;
}

export function loadDoc(storage: StorageLike | null): LoadResult {
  if (!storage) return { doc: null };
  const text = storage.getItem(DOC_KEY);
  if (!text) return { doc: null };
  try {
    return { doc: migrateDoc(JSON.parse(text)) };
  } catch (e) {
    storage.setItem(BROKEN_KEY, text);
    const msg = e instanceof Error ? e.message : String(e);
    return { doc: null, error: `저장된 데이터를 읽지 못해 샘플로 시작합니다. (${msg})` };
  }
}

export function saveDoc(storage: StorageLike | null, doc: ProjectDoc): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DOC_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function loadUiPrefs(storage: StorageLike | null): Partial<UiPrefs> {
  if (!storage) return {};
  try {
    const raw = JSON.parse(storage.getItem(UI_KEY) ?? '{}');
    const out: Partial<UiPrefs> = {};
    if (['split', '2d', '3d'].includes(raw.view)) out.view = raw.view;
    if (['auto', 'solid', 'hidden'].includes(raw.walls3d)) out.walls3d = raw.walls3d;
    if (raw.snap && typeof raw.snap === 'object') out.snap = raw.snap;
    return out;
  } catch {
    return {};
  }
}

/**
 * store가 바뀔 때마다 (잠시 모아서) 저장한다. 열람 모드(공유 링크)에서는 내 저장소를 건드리지 않는다.
 * @returns 구독 해제 함수
 */
export function startAutoSave(
  store: Store<AppState>,
  storage: StorageLike | null,
  onError: (msg: string) => void,
  delay = 400,
): () => void {
  if (!storage) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastDoc = store.getState().history.present;
  let lastPrefs = '';
  let failed = false;

  const flush = () => {
    timer = null;
    const s = store.getState();
    if (s.ui.readOnly) return;
    if (s.history.present !== lastDoc) {
      if (saveDoc(storage, s.history.present)) {
        lastDoc = s.history.present;
        failed = false;
      } else if (!failed) {
        failed = true;
        onError('브라우저 저장 공간에 저장하지 못했습니다. JSON 내보내기로 백업해 주세요.');
      }
    }
    const prefs = JSON.stringify({ view: s.ui.view, snap: s.ui.snap, walls3d: s.ui.walls3d });
    if (prefs !== lastPrefs) {
      try {
        storage.setItem(UI_KEY, prefs);
        lastPrefs = prefs;
      } catch {
        /* 화면 설정은 저장 못 해도 괜찮다 */
      }
    }
  };

  const unsub = store.subscribe(() => {
    if (timer === null) timer = setTimeout(flush, delay);
  });
  const onHide = () => {
    if (timer !== null) {
      clearTimeout(timer);
      flush();
    }
  };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onHide);
  return () => {
    unsub();
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onHide);
    if (timer !== null) clearTimeout(timer);
  };
}
