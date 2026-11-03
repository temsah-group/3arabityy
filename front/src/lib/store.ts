import { useSyncExternalStore } from 'react';

/** A value kept in localStorage that components can subscribe to. */
export function persisted<T>(key: string, initial: T) {
  let value: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = JSON.parse(raw) as T;
  } catch {
    value = initial;
  }
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set(next: T) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full or blocked: keep it in memory.
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    use(): T {
      return useSyncExternalStore(this.subscribe, this.get);
    },
  };
}
