import type { Id } from './types';

/**
 * 짧은 무작위 id. 공유 링크 길이를 줄이려고 UUID 대신 8자리 base36을 쓴다.
 * 한 문서 안의 수백 개 객체 수준에서는 충돌 확률이 무시할 만하다.
 */
export function newId(prefix = ''): Id {
  let s = '';
  while (s.length < 8) s += Math.random().toString(36).slice(2);
  return prefix + s.slice(0, 8);
}
