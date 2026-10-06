// 패널에서 "가구 추가"를 누르면 지금 보고 있는 평면도 가운데에 놓기 위한 연결 고리.

import type { Vec2 } from '../model/types';

let centerFn: (() => Vec2) | null = null;

export function registerViewCenter(fn: (() => Vec2) | null) {
  centerFn = fn;
}

export function getViewCenter(): Vec2 | null {
  return centerFn ? centerFn() : null;
}
