// 저장된 문서(localStorage, JSON 파일, 공유 링크)는 모두 여기를 거쳐 현재 스키마로 올라온다.

import { SCHEMA_VERSION } from './types';
import type { ProjectDoc, SharePayload } from './types';

export class DocError extends Error {}

type AnyObj = Record<string, any>;
export type MigrationTable = Record<number, (doc: AnyObj) => AnyObj>;

/**
 * 버전 n → n+1 변환 함수. 스키마를 바꿀 때 SCHEMA_VERSION을 올리고 여기에 한 줄 추가한다.
 * 예) 1: (d) => ({ ...d, version: 2, house: { ...d.house, newField: 기본값 } }),
 */
export const MIGRATIONS: MigrationTable = {};

export function runMigrations(raw: unknown, table: MigrationTable, target: number): AnyObj {
  if (!isObj(raw)) throw new DocError('올바른 데이터 형식이 아닙니다.');
  let doc: AnyObj = raw;
  if (typeof doc.version !== 'number') throw new DocError('버전 정보가 없는 파일입니다.');
  if (doc.version > target) {
    throw new DocError('더 새로운 버전의 앱에서 만든 파일입니다. 페이지를 새로고침해 주세요.');
  }
  while (doc.version < target) {
    const step = table[doc.version];
    if (!step) throw new DocError(`버전 ${doc.version} 파일은 변환할 수 없습니다.`);
    doc = step(doc);
  }
  return doc;
}

export function migrateDoc(raw: unknown): ProjectDoc {
  const d = runMigrations(raw, MIGRATIONS, SCHEMA_VERSION);
  checkHouse(d.house);
  if (!Array.isArray(d.layouts) || d.layouts.length === 0) {
    throw new DocError('배치안이 하나도 없습니다.');
  }
  d.layouts.forEach(checkLayout);
  const activeLayoutId = d.layouts.some((l: AnyObj) => l.id === d.activeLayoutId)
    ? d.activeLayoutId
    : d.layouts[0].id;
  return {
    version: SCHEMA_VERSION,
    house: normalizeHouse(d.house),
    layouts: d.layouts,
    activeLayoutId,
    userPresets: Array.isArray(d.userPresets) ? d.userPresets : [],
  };
}

export function migrateShare(raw: unknown): SharePayload {
  const d = runMigrations(raw, MIGRATIONS, SCHEMA_VERSION);
  checkHouse(d.house);
  checkLayout(d.layout);
  return { version: SCHEMA_VERSION, house: normalizeHouse(d.house), layout: d.layout };
}

function isObj(v: unknown): v is AnyObj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkHouse(h: unknown): asserts h is AnyObj {
  if (!isObj(h) || !Array.isArray(h.rooms) || !Array.isArray(h.walls)) {
    throw new DocError('집 구조 정보가 올바르지 않습니다.');
  }
}

function checkLayout(l: unknown) {
  if (!isObj(l) || typeof l.id !== 'string' || !Array.isArray(l.furniture)) {
    throw new DocError('배치안 정보가 올바르지 않습니다.');
  }
}

/** 선택 필드가 빠진 파일도 열리도록 기본값을 채운다. */
function normalizeHouse(h: AnyObj): ProjectDoc['house'] {
  return {
    ceilingHeight: typeof h.ceilingHeight === 'number' ? h.ceilingHeight : 240,
    rooms: h.rooms,
    walls: h.walls,
    doors: Array.isArray(h.doors) ? h.doors : [],
    windows: Array.isArray(h.windows) ? h.windows : [],
    fixtures: Array.isArray(h.fixtures) ? h.fixtures : [],
  };
}
