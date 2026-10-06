import { describe, expect, it } from 'vitest';
import { commitGesture, initHistory, pushHistory, redo, replacePresent, undo } from './history';

describe('history', () => {
  it('push → undo → redo', () => {
    let h = initHistory(1);
    h = pushHistory(h, 2);
    h = pushHistory(h, 3);
    expect(h.present).toBe(3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(undo(h)).toBe(h);
    h = redo(h);
    expect(h.present).toBe(2);
    expect(h.future).toEqual([3]);
  });

  it('새로 push하면 redo 기록이 사라진다', () => {
    let h = pushHistory(pushHistory(initHistory(1), 2), 3);
    h = undo(h);
    h = pushHistory(h, 9);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual([1, 2]);
  });

  it('같은 값이면 기록하지 않는다', () => {
    const h = initHistory({ a: 1 });
    expect(pushHistory(h, h.present)).toBe(h);
  });

  it('최대 개수를 넘으면 오래된 것부터 버린다', () => {
    let h = initHistory(0);
    for (let i = 1; i <= 10; i++) h = pushHistory(h, i, 3);
    expect(h.past).toEqual([7, 8, 9]);
  });

  it('드래그 중 여러 번 바꿔도 Undo는 한 번이다', () => {
    let h = pushHistory(initHistory('a'), 'b');
    const base = h.present;
    h = replacePresent(h, 'b1');
    h = replacePresent(h, 'b2');
    h = replacePresent(h, 'b3');
    h = commitGesture(h, base);
    expect(h.past).toEqual(['a', 'b']);
    expect(undo(h).present).toBe('b');
  });

  it('아무것도 바뀌지 않은 드래그는 기록하지 않는다', () => {
    const h = initHistory('a');
    expect(commitGesture(h, 'a')).toBe(h);
  });
});
