// ProjectDoc을 다루는 순수 함수 모음. 변경이 없으면 같은 객체를 그대로 돌려줘서
// store가 "변화 없음"을 참조 비교만으로 알 수 있게 한다.

import { newId } from './ids';
import type { Furniture, FurniturePreset, House, Id, Layout, ProjectDoc } from './types';

export const MIN_SIZE = 1;

export function normalizeAngle(deg: number): number {
  let r = deg % 360;
  if (r < 0) r += 360;
  return r === 0 || r === 360 ? 0 : r;
}

export function getActiveLayout(doc: ProjectDoc): Layout {
  return doc.layouts.find((l) => l.id === doc.activeLayoutId) ?? doc.layouts[0];
}

export function findFurniture(doc: ProjectDoc, id: Id): Furniture | undefined {
  return getActiveLayout(doc).furniture.find((f) => f.id === id);
}

function updateLayout(doc: ProjectDoc, layoutId: Id, fn: (l: Layout) => Layout): ProjectDoc {
  let changed = false;
  const layouts = doc.layouts.map((l) => {
    if (l.id !== layoutId) return l;
    const next = fn(l);
    if (next !== l) changed = true;
    return next;
  });
  return changed ? { ...doc, layouts } : doc;
}

function updateActiveFurniture(
  doc: ProjectDoc,
  fn: (list: Furniture[]) => Furniture[],
): ProjectDoc {
  return updateLayout(doc, getActiveLayout(doc).id, (l) => {
    const furniture = fn(l.furniture);
    return furniture === l.furniture ? l : { ...l, furniture, updatedAt: Date.now() };
  });
}

// ───────── 가구 ─────────

export function addFurniture(doc: ProjectDoc, f: Furniture): ProjectDoc {
  return updateActiveFurniture(doc, (list) => [...list, sanitizeFurniture(f)]);
}

export type FurniturePatch = Partial<Omit<Furniture, 'id'>>;

export function sanitizeFurniture(f: Furniture): Furniture {
  return {
    ...f,
    width: Math.max(MIN_SIZE, f.width),
    depth: Math.max(MIN_SIZE, f.depth),
    height: Math.max(MIN_SIZE, f.height),
    rotation: normalizeAngle(f.rotation),
    ...(f.elevation !== undefined ? { elevation: Math.max(0, f.elevation) } : {}),
  };
}

export function updateFurniture(doc: ProjectDoc, id: Id, patch: FurniturePatch): ProjectDoc {
  return updateActiveFurniture(doc, (list) => {
    let changed = false;
    const next = list.map((f) => {
      if (f.id !== id) return f;
      const updated = sanitizeFurniture({ ...f, ...patch });
      if ((Object.keys(updated) as (keyof Furniture)[]).every((k) => updated[k] === f[k])) return f;
      changed = true;
      return updated;
    });
    return changed ? next : list;
  });
}

export function removeFurniture(doc: ProjectDoc, id: Id): ProjectDoc {
  return updateActiveFurniture(doc, (list) => {
    const next = list.filter((f) => f.id !== id);
    return next.length === list.length ? list : next;
  });
}

/** 복제본은 원본에서 offset만큼 비켜 놓는다. 새 id를 함께 돌려준다. */
export function duplicateFurniture(
  doc: ProjectDoc,
  id: Id,
  offset = 20,
): { doc: ProjectDoc; newId: Id | null } {
  const src = findFurniture(doc, id);
  if (!src) return { doc, newId: null };
  const copy: Furniture = { ...src, id: newId('f'), x: src.x + offset, y: src.y + offset };
  return { doc: addFurniture(doc, copy), newId: copy.id };
}

// ───────── 배치안 ─────────

/** "A안", "B안" … 중 아직 안 쓴 이름. 26개를 넘으면 "배치안 27" 식으로 */
export function nextLayoutName(doc: ProjectDoc): string {
  const used = new Set(doc.layouts.map((l) => l.name));
  for (let i = 0; i < 26; i++) {
    const name = `${String.fromCharCode(65 + i)}안`;
    if (!used.has(name)) return name;
  }
  let n = doc.layouts.length + 1;
  while (used.has(`배치안 ${n}`)) n++;
  return `배치안 ${n}`;
}

export function setActiveLayout(doc: ProjectDoc, id: Id): ProjectDoc {
  if (doc.activeLayoutId === id || !doc.layouts.some((l) => l.id === id)) return doc;
  return { ...doc, activeLayoutId: id };
}

export function addLayout(doc: ProjectDoc, name = nextLayoutName(doc)): ProjectDoc {
  const layout: Layout = { id: newId('l'), name, furniture: [], updatedAt: Date.now() };
  return { ...doc, layouts: [...doc.layouts, layout], activeLayoutId: layout.id };
}

/** 가구까지 새 id로 깊은 복사하고, 복사본을 활성화한다. */
export function duplicateLayout(doc: ProjectDoc, id: Id, name?: string): ProjectDoc {
  const src = doc.layouts.find((l) => l.id === id);
  if (!src) return doc;
  const copy: Layout = {
    id: newId('l'),
    name: name ?? `${src.name} 복사본`,
    updatedAt: Date.now(),
    furniture: src.furniture.map((f) => ({ ...f, id: newId('f') })),
  };
  const idx = doc.layouts.indexOf(src);
  const layouts = [...doc.layouts.slice(0, idx + 1), copy, ...doc.layouts.slice(idx + 1)];
  return { ...doc, layouts, activeLayoutId: copy.id };
}

export function renameLayout(doc: ProjectDoc, id: Id, name: string): ProjectDoc {
  const trimmed = name.trim();
  if (!trimmed) return doc;
  return updateLayout(doc, id, (l) => (l.name === trimmed ? l : { ...l, name: trimmed }));
}

/** 마지막 하나는 지우지 않는다. 활성 배치안을 지우면 이웃 배치안이 활성화된다. */
export function deleteLayout(doc: ProjectDoc, id: Id): ProjectDoc {
  if (doc.layouts.length <= 1) return doc;
  const idx = doc.layouts.findIndex((l) => l.id === id);
  if (idx < 0) return doc;
  const layouts = doc.layouts.filter((l) => l.id !== id);
  const activeLayoutId =
    doc.activeLayoutId === id ? layouts[Math.min(idx, layouts.length - 1)].id : doc.activeLayoutId;
  return { ...doc, layouts, activeLayoutId };
}

// ───────── 사용자 프리셋 ─────────

export function saveFurnitureAsPreset(
  doc: ProjectDoc,
  furnitureId: Id,
  name?: string,
): ProjectDoc {
  const f = findFurniture(doc, furnitureId);
  if (!f) return doc;
  const preset: FurniturePreset = {
    id: newId('p'),
    name: name?.trim() || f.name,
    shape: f.shape,
    width: f.width,
    depth: f.depth,
    height: f.height,
    color: f.color,
    builtin: false,
  };
  return { ...doc, userPresets: [...doc.userPresets, preset] };
}

export function deleteUserPreset(doc: ProjectDoc, id: Id): ProjectDoc {
  const userPresets = doc.userPresets.filter((p) => p.id !== id);
  return userPresets.length === doc.userPresets.length ? doc : { ...doc, userPresets };
}

// ───────── 구조 ─────────

export function updateHouse(doc: ProjectDoc, fn: (h: House) => House): ProjectDoc {
  const house = fn(doc.house);
  return house === doc.house ? doc : { ...doc, house };
}
