export type Listener = () => void;

export interface Store<S> {
  getState(): S;
  setState(update: S | ((prev: S) => S)): void;
  subscribe(listener: Listener): () => void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState(update) {
      const next = typeof update === 'function' ? (update as (prev: S) => S)(state) : update;
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
