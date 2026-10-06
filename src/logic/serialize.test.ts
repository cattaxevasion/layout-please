import { describe, expect, it } from 'vitest';
import { getActiveLayout } from '../model/ops';
import { createSampleDoc } from '../model/sample';
import { decodeShare, encodeShare } from './share';
import { exportDocJson, exportFileName, importDocJson, mergeShareIntoDoc } from './serialize';

describe('JSON 내보내기/불러오기', () => {
  it('왕복', () => {
    const d = createSampleDoc();
    expect(importDocJson(exportDocJson(d))).toEqual(d);
  });

  it('JSON이 아니면 한국어 오류', () => {
    expect(() => importDocJson('not json')).toThrow('JSON 형식이 아닌');
    expect(() => importDocJson('{"version":1}')).toThrow('집 구조');
  });

  it('파일 이름에 날짜', () => {
    expect(exportFileName(new Date(2026, 9, 6))).toBe('layout-please-20261006.json');
  });
});

describe('공유받은 배치안 합치기', () => {
  it('집 구조가 같으면 배치안을 새 id로 추가하고 활성화', () => {
    const mine = createSampleDoc();
    const share = decodeShare(encodeShare(mine.house, getActiveLayout(mine)));
    const merged = mergeShareIntoDoc(mine, share)!;
    expect(merged.layouts).toHaveLength(3);
    const added = merged.layouts[2];
    expect(merged.activeLayoutId).toBe(added.id);
    expect(added.name).toBe('A안 (공유)'); // 이름이 겹치면 표시를 붙인다
    const ids = new Set(mine.layouts.flatMap((l) => l.furniture.map((f) => f.id)));
    expect(added.furniture.some((f) => ids.has(f.id))).toBe(false);
  });

  it('집 구조가 다르면 null', () => {
    const mine = createSampleDoc();
    const other = createSampleDoc();
    other.house = { ...other.house, ceilingHeight: 250 };
    const share = decodeShare(encodeShare(other.house, getActiveLayout(other)));
    expect(mergeShareIntoDoc(mine, share)).toBeNull();
  });
});
