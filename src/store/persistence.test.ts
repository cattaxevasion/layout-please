import { describe, expect, it } from 'vitest';
import { createSampleDoc } from '../model/sample';
import { BROKEN_KEY, DOC_KEY, loadDoc, loadUiPrefs, saveDoc, UI_KEY, type StorageLike } from './persistence';

function fakeStorage(init: Record<string, string> = {}, failWrites = false): StorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe('localStorage 저장', () => {
  it('저장 → 불러오기', () => {
    const s = fakeStorage();
    const d = createSampleDoc();
    expect(saveDoc(s, d)).toBe(true);
    expect(loadDoc(s).doc).toEqual(d);
  });

  it('저장된 것이 없으면 null', () => {
    expect(loadDoc(fakeStorage())).toEqual({ doc: null });
    expect(loadDoc(null)).toEqual({ doc: null });
  });

  it('깨진 데이터는 따로 옮겨 두고 안내 문구', () => {
    const s = fakeStorage({ [DOC_KEY]: '{"version": 1, "house": 3}' });
    const r = loadDoc(s);
    expect(r.doc).toBeNull();
    expect(r.error).toContain('샘플로 시작');
    expect(s.data[BROKEN_KEY]).toBe('{"version": 1, "house": 3}');
  });

  it('저장 공간이 꽉 차면 false', () => {
    expect(saveDoc(fakeStorage({}, true), createSampleDoc())).toBe(false);
  });

  it('화면 설정은 알려진 값만 받아들인다', () => {
    const s = fakeStorage({ [UI_KEY]: JSON.stringify({ view: '3d', walls3d: 'weird', readOnly: true }) });
    expect(loadUiPrefs(s)).toEqual({ view: '3d' });
    expect(loadUiPrefs(fakeStorage({ [UI_KEY]: 'not json' }))).toEqual({});
  });
});
