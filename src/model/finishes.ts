// 마감재(바닥재, 벽지, 문 표면) 목록. 질감 이미지는 public/textures/ 에 있다.
// 이미지는 반복(타일)되도록 만들어 두었고, tileCm는 이미지 한 장이 실제로 덮는 크기다.

import type { Id } from './types';

export type FinishKind = 'floor' | 'wall' | 'door';

export interface Finish {
  id: Id;
  label: string;
  kind: FinishKind;
  file: string;
  /** 이미지 한 장의 실제 크기 [가로, 세로] cm */
  tileCm: [number, number];
  /** 질감을 못 불러올 때와 2D 표시용 평균 색 */
  color: string;
}

export const FINISHES: readonly Finish[] = [
  {
    id: 'home-floor',
    label: '회백색 마루 (판 폭 15cm)',
    kind: 'floor',
    file: 'home-floor.jpg',
    tileCm: [60, 180],
    color: '#d5d2cb',
  },
  { id: 'home-wall', label: '흰 벽지 (엠보싱)', kind: 'wall', file: 'home-wall.jpg', tileCm: [25, 25], color: '#e2ded5' },
  {
    id: 'home-accent',
    label: '그레이지 리넨 벽지',
    kind: 'wall',
    file: 'home-accent.jpg',
    tileCm: [25, 25],
    color: '#afa493',
  },
  {
    id: 'home-closet',
    label: '그레이지 나뭇결',
    kind: 'door',
    file: 'home-closet.jpg',
    tileCm: [45, 45],
    color: '#b9ad9a',
  },
];

/** 벽의 finish에 이 값을 넣으면 집 기본 벽지 대신 단색 벽 */
export const PLAIN = 'plain';

export const finishById = (id: Id | undefined | null): Finish | undefined =>
  id ? FINISHES.find((f) => f.id === id) : undefined;

export const finishesOf = (kind: FinishKind) => FINISHES.filter((f) => f.kind === kind);
