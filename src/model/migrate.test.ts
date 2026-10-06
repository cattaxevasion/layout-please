import { describe, expect, it } from 'vitest';
import { DocError, migrateDoc, runMigrations } from './migrate';
import { createSampleDoc } from './sample';

describe('migrate', () => {
  it('현재 버전 문서는 JSON 왕복 후 그대로', () => {
    const d = createSampleDoc();
    expect(migrateDoc(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('마이그레이션을 차례로 적용', () => {
    const table = {
      1: (d: any) => ({ ...d, version: 2, a: 1 }),
      2: (d: any) => ({ ...d, version: 3, b: d.a + 1 }),
    };
    expect(runMigrations({ version: 1 }, table, 3)).toEqual({ version: 3, a: 1, b: 2 });
  });

  it('잘못된 입력은 한국어 오류', () => {
    expect(() => migrateDoc(null)).toThrow(DocError);
    expect(() => migrateDoc({})).toThrow('버전 정보가 없는');
    expect(() => migrateDoc({ version: 999 })).toThrow('더 새로운 버전');
    expect(() => migrateDoc({ version: 1, house: {} })).toThrow('집 구조');
  });

  it('빠진 선택 필드는 기본값으로 채우고, 없는 활성 배치안은 첫 번째로', () => {
    const d: any = JSON.parse(JSON.stringify(createSampleDoc()));
    delete d.house.fixtures;
    delete d.userPresets;
    d.activeLayoutId = 'nope';
    const m = migrateDoc(d);
    expect(m.house.fixtures).toEqual([]);
    expect(m.userPresets).toEqual([]);
    expect(m.activeLayoutId).toBe(d.layouts[0].id);
  });
});
