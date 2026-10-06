import { useEffect, useRef, useState } from 'preact/hooks';
import type { Store } from './createStore';

/** selector 결과가 바뀔 때만 다시 렌더링한다. */
export function useStore<S, T>(
  store: Store<S>,
  selector: (s: S) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T {
  const [, force] = useState(0);
  const value = selector(store.getState());
  const selectorRef = useRef(selector);
  const valueRef = useRef(value);
  selectorRef.current = selector;
  valueRef.current = value;

  useEffect(
    () =>
      store.subscribe(() => {
        const next = selectorRef.current(store.getState());
        if (!equal(next, valueRef.current)) force((n) => n + 1);
      }),
    [store],
  );
  return value;
}
