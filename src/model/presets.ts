import { newId } from './ids';
import type { Furniture, FurniturePreset, ShapeKind } from './types';

export const MY_GROUP = '우리 집 가구';
export const BASIC_GROUP = '기본 가구';

const p = (
  id: string,
  name: string,
  shape: ShapeKind,
  width: number,
  depth: number,
  height: number,
  color: string,
  group = BASIC_GROUP,
): FurniturePreset => ({ id, name, shape, width, depth, height, color, builtin: true, group });

export const BUILTIN_PRESETS: readonly FurniturePreset[] = [
  // 실제로 가진 가구 (제품 치수 기준)
  p('my-desk', '스탠딩 책상', 'standingDesk', 120, 70, 72, '#f1efea', MY_GROUP),
  p('my-chair', '메쉬 의자', 'officeChair', 67, 67, 125, '#8f989d', MY_GROUP),
  p('my-drawers', '3단 서랍장', 'drawers', 69, 38, 67, '#ddd6c3', MY_GROUP),
  p('my-side-table', '사이드 테이블', 'bookshelf', 39, 30, 67, '#ddd6c3', MY_GROUP),
  p('my-metal-shelf', '수납 선반 (검정)', 'metalShelf', 85, 55, 110, '#2b2b2b', MY_GROUP),
  p('my-water-server', '워터서버', 'waterServer', 27.1, 37, 116.2, '#f4f4f2', MY_GROUP),
  // 샤프 SJ-GD14D (137L) 48×60×112.5 위에 히타치 전자레인지 48.6×41.2×29.6
  p('my-fridge-microwave', '냉장고 + 전자레인지', 'fridgeMicrowave', 48.6, 60, 142.1, '#f4f4f2', MY_GROUP),
  p('my-fridge', '냉장고 (SJ-GD14D)', 'fridge', 48, 60, 112.5, '#f4f4f2', MY_GROUP),
  p('my-microwave', '전자레인지', 'microwave', 48.6, 41.2, 29.6, '#f4f4f2', MY_GROUP),

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
  standingDesk: '스탠딩 책상',
  officeChair: '사무용 의자',
  drawers: '서랍장',
  metalShelf: '금속 선반',
  fridge: '냉장고',
  waterServer: '워터서버',
  microwave: '전자레인지',
  fridgeMicrowave: '냉장고 + 전자레인지',
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
