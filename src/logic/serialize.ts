// JSON 파일 내보내기/불러오기.

import { DocError, migrateDoc } from '../model/migrate';
import { newId } from '../model/ids';
import type { House, Layout, ProjectDoc, SharePayload } from '../model/types';
import { houseSignature } from './share';

export function exportDocJson(doc: ProjectDoc): string {
  return JSON.stringify(doc, null, 2);
}

export function importDocJson(text: string): ProjectDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DocError('JSON 형식이 아닌 파일입니다.');
  }
  return migrateDoc(raw);
}

export function exportFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `layout-please-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}.json`;
}

/** 공유받은 배치안을 내 문서에 넣을 때: 가구 id까지 새로 만들어 기존 것과 겹치지 않게 한다 */
export function cloneLayoutFresh(layout: Layout, name = layout.name): Layout {
  return {
    id: newId('l'),
    name,
    updatedAt: Date.now(),
    furniture: layout.furniture.map((f) => ({ ...f, id: newId('f') })),
  };
}

/** 두 집 구조가 같은지 (공유 링크 가져오기에서 배치안만 추가할지 판단). id 차이는 무시한다. */
export function sameHouse(a: House, b: House): boolean {
  return houseSignature(a) === houseSignature(b);
}

/** 공유 데이터만으로 만든 문서 (열람용 또는 내 저장소가 비어 있을 때) */
export function docFromShare(share: SharePayload, userPresets: ProjectDoc['userPresets'] = []): ProjectDoc {
  return {
    version: share.version,
    house: share.house,
    layouts: [share.layout],
    activeLayoutId: share.layout.id,
    userPresets,
  };
}

/**
 * 공유받은 배치안을 내 문서에 합친다.
 * 집 구조가 같으면 배치안만 추가, 다르면 null (호출하는 쪽에서 교체 여부를 묻는다).
 */
export function mergeShareIntoDoc(mine: ProjectDoc, share: SharePayload): ProjectDoc | null {
  if (!sameHouse(mine.house, share.house)) return null;
  const used = new Set(mine.layouts.map((l) => l.name));
  let name = share.layout.name;
  if (used.has(name)) name = `${name} (공유)`;
  const layout = cloneLayoutFresh(share.layout, name);
  return { ...mine, layouts: [...mine.layouts, layout], activeLayoutId: layout.id };
}
