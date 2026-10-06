import { newId } from './ids';
import type { Furniture, FurniturePreset, ShapeKind } from './types';

const p = (
  id: string,
  name: string,
  shape: ShapeKind,
  width: number,
  depth: number,
  height: number,
  color: string,
): FurniturePreset => ({ id, name, shape, width, depth, height, color, builtin: true });

export const BUILTIN_PRESETS: readonly FurniturePreset[] = [
  p('bed-single', '침대 (싱글)', 'bed', 100, 200, 45, '#c9b79c'),
  p('bed-queen', '침대 (퀸)', 'bed', 150, 200, 45, '#c9b79c'),
  p('sofa-2', '소파 (2인)', 'sofa', 160, 85, 80, '#6f8fa8'),
  p('sofa-3', '소파 (3인)', 'sofa', 200, 90, 80, '#6f8fa8'),
  p('desk', '책상', 'desk', 120, 60, 73, '#b08a5e'),
  p('chair', '의자', 'chair', 45, 50, 85, '#7a6a58'),
  p('storage', '수납장', 'storage', 80, 40, 90, '#d8cfc0'),
  p('dining-2', '식탁 (2인)', 'diningTable', 80, 70, 72, '#a07850'),
  p('dining-4', '식탁 (4인)', 'diningTable', 120, 75, 72, '#a07850'),
  p('tv-stand', 'TV대', 'tvStand', 150, 40, 45, '#4a4a4a'),
  p('bookshelf', '책장', 'bookshelf', 80, 30, 180, '#b5916a'),
  p('box', '박스', 'box', 50, 50, 50, '#9aa5b1'),
];

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  box: '박스',
  bed: '침대',
  sofa: '소파',
  desk: '책상',
  chair: '의자',
  storage: '수납장',
  diningTable: '식탁',
  tvStand: 'TV대',
  bookshelf: '책장',
};

export function furnitureFromPreset(
  preset: FurniturePreset,
  at: { x: number; y: number },
  rotation = 0,
): Furniture {
  return {
    id: newId('f'),
    name: preset.name,
    shape: preset.shape,
    presetId: preset.id,
    width: preset.width,
    depth: preset.depth,
    height: preset.height,
    color: preset.color,
    x: at.x,
    y: at.y,
    rotation,
  };
}
