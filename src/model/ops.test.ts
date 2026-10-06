import { describe, expect, it } from 'vitest';
import * as ops from './ops';
import { createSampleDoc } from './sample';

const firstId = (d = createSampleDoc()) => ops.getActiveLayout(d).furniture[0].id;

describe('normalizeAngle', () => {
  it.each([
    [0, 0],
    [360, 0],
    [-90, 270],
    [450, 90],
    [-360, 0],
    [12.5, 12.5],
  ])('%d → %d', (input, out) => {
    expect(ops.normalizeAngle(input)).toBe(out);
  });
});

describe('가구', () => {
  it('수정하면 새 문서, 같은 값이면 같은 문서', () => {
    const d = createSampleDoc();
    const id = firstId(d);
    const f = ops.findFurniture(d, id)!;
    expect(ops.updateFurniture(d, id, { x: f.x })).toBe(d);
    const d2 = ops.updateFurniture(d, id, { x: f.x + 10 });
    expect(d2).not.toBe(d);
    expect(ops.findFurniture(d2, id)!.x).toBe(f.x + 10);
    // 다른 배치안은 같은 객체를 공유한다
    expect(d2.layouts[1]).toBe(d.layouts[1]);
  });

  it('치수는 최소 1, 각도는 0~360으로 정규화', () => {
    const d = createSampleDoc();
    const id = firstId(d);
    const d2 = ops.updateFurniture(d, id, { width: -5, rotation: -90 });
    const f = ops.findFurniture(d2, id)!;
    expect(f.width).toBe(1);
    expect(f.rotation).toBe(270);
  });

  it('복제하면 새 id로 옆에 놓인다', () => {
    const d = createSampleDoc();
    const id = firstId(d);
    const { doc, newId } = ops.duplicateFurniture(d, id);
    expect(newId).not.toBe(id);
    const src = ops.findFurniture(doc, id)!;
    const copy = ops.findFurniture(doc, newId!)!;
    expect(copy.x).toBe(src.x + 20);
    expect(copy.name).toBe(src.name);
  });

  it('삭제', () => {
    const d = createSampleDoc();
    const id = firstId(d);
    const d2 = ops.removeFurniture(d, id);
    expect(ops.findFurniture(d2, id)).toBeUndefined();
    expect(ops.removeFurniture(d2, id)).toBe(d2);
  });
});

describe('배치안', () => {
  it('복제는 가구까지 새 id로 깊은 복사하고 복사본을 활성화', () => {
    const d = createSampleDoc();
    const src = d.layouts[0];
    const d2 = ops.duplicateLayout(d, src.id);
    expect(d2.layouts).toHaveLength(3);
    const copy = d2.layouts[1];
    expect(d2.activeLayoutId).toBe(copy.id);
    expect(copy.name).toBe('A안 복사본');
    expect(copy.furniture).toHaveLength(src.furniture.length);
    const srcIds = new Set(src.furniture.map((f) => f.id));
    expect(copy.furniture.some((f) => srcIds.has(f.id))).toBe(false);
  });

  it('새 배치안 이름은 비어 있는 다음 글자', () => {
    const d = createSampleDoc(); // A안, B안
    expect(ops.nextLayoutName(d)).toBe('C안');
  });

  it('마지막 배치안은 지울 수 없고, 활성 배치안을 지우면 이웃이 활성화', () => {
    let d = createSampleDoc();
    const [a, b] = d.layouts;
    d = ops.deleteLayout(d, a.id);
    expect(d.activeLayoutId).toBe(b.id);
    expect(ops.deleteLayout(d, b.id)).toBe(d);
  });

  it('빈 이름으로는 바꾸지 않는다', () => {
    const d = createSampleDoc();
    expect(ops.renameLayout(d, d.layouts[0].id, '  ')).toBe(d);
    expect(ops.renameLayout(d, d.layouts[0].id, ' 거실 넓게 ').layouts[0].name).toBe('거실 넓게');
  });
});

describe('사용자 프리셋', () => {
  it('가구를 프리셋으로 저장', () => {
    const d = createSampleDoc();
    const id = firstId(d);
    const d2 = ops.saveFurnitureAsPreset(d, id, '우리 소파');
    expect(d2.userPresets).toHaveLength(1);
    expect(d2.userPresets[0]).toMatchObject({ name: '우리 소파', builtin: false, shape: 'sofa' });
    expect(ops.deleteUserPreset(d2, d2.userPresets[0].id).userPresets).toHaveLength(0);
  });
});
