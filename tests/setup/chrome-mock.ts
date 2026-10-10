/**
 * In-memory mock for chrome.storage.local, chrome.storage.session,
 * and chrome.storage.onChanged event dispatcher.
 */

type StorageChange = chrome.storage.StorageChange;
type StorageListener = (changes: { [key: string]: StorageChange }, areaName: string) => void;

export interface ChromeStorageMockController {
  reset(): void;
  getRaw(area: 'local' | 'session'): Record<string, unknown>;
  setRaw(area: 'local' | 'session', key: string, value: unknown): void;
}

class MemoryStorageArea {
  private store: Record<string, unknown> = {};

  constructor(
    private readonly areaName: 'local' | 'session',
    private readonly notify: (changes: Record<string, StorageChange>, areaName: string) => void,
  ) {}

  async get(
    keys?: string | string[] | Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> {
    if (keys === null || keys === undefined) {
      return { ...this.store };
    }

    if (typeof keys === 'string') {
      const val = this.store[keys];
      return val !== undefined ? { [keys]: val } : {};
    }

    if (Array.isArray(keys)) {
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (this.store[k] !== undefined) {
          result[k] = this.store[k];
        }
      }
      return result;
    }

    if (typeof keys === 'object') {
      const result: Record<string, unknown> = { ...keys };
      for (const k of Object.keys(keys)) {
        if (this.store[k] !== undefined) {
          result[k] = this.store[k];
        }
      }
      return result;
    }

    return {};
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, StorageChange> = {};

    for (const [k, newVal] of Object.entries(items)) {
      const oldVal = this.store[k];
      if (oldVal !== newVal) {
        changes[k] = {
          oldValue: oldVal,
          newValue: newVal,
        };
        this.store[k] = newVal;
      }
    }

    if (Object.keys(changes).length > 0) {
      this.notify(changes, this.areaName);
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, StorageChange> = {};

    for (const k of list) {
      if (this.store[k] !== undefined) {
        changes[k] = {
          oldValue: this.store[k],
          newValue: undefined,
        };
        delete this.store[k];
      }
    }

    if (Object.keys(changes).length > 0) {
      this.notify(changes, this.areaName);
    }
  }

  async clear(): Promise<void> {
    const changes: Record<string, StorageChange> = {};
    for (const [k, val] of Object.entries(this.store)) {
      changes[k] = {
        oldValue: val,
        newValue: undefined,
      };
    }
    this.store = {};

    if (Object.keys(changes).length > 0) {
      this.notify(changes, this.areaName);
    }
  }

  // Internal test helpers
  _getRaw(): Record<string, unknown> {
    return this.store;
  }

  _setRaw(key: string, value: unknown): void {
    this.store[key] = value;
  }

  _reset(): void {
    this.store = {};
  }
}

class StorageChangedEvent {
  private listeners = new Set<StorageListener>();

  addListener(listener: StorageListener): void {
    this.listeners.add(listener);
  }

  removeListener(listener: StorageListener): void {
    this.listeners.delete(listener);
  }

  hasListener(listener: StorageListener): boolean {
    return this.listeners.has(listener);
  }

  dispatch(changes: Record<string, StorageChange>, areaName: string): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(changes, areaName);
      } catch (err) {
        console.error('Storage listener threw error:', err);
      }
    }
  }

  _reset(): void {
    this.listeners.clear();
  }
}

export function installChromeMock(): ChromeStorageMockController {
  const changedEvent = new StorageChangedEvent();

  const notify = (changes: Record<string, StorageChange>, areaName: string) => {
    changedEvent.dispatch(changes, areaName);
  };

  const localArea = new MemoryStorageArea('local', notify);
  const sessionArea = new MemoryStorageArea('session', notify);

  const mockChrome = {
    ...(globalThis.chrome || {}),
    storage: {
      local: localArea,
      session: sessionArea,
      onChanged: changedEvent,
    },
  };

  // @ts-expect-error Mocking global chrome
  globalThis.chrome = mockChrome;

  return {
    reset() {
      localArea._reset();
      sessionArea._reset();
      changedEvent._reset();
    },
    getRaw(area: 'local' | 'session') {
      return area === 'local' ? localArea._getRaw() : sessionArea._getRaw();
    },
    setRaw(area: 'local' | 'session', key: string, value: unknown) {
      if (area === 'local') {
        localArea._setRaw(key, value);
      } else {
        sessionArea._setRaw(key, value);
      }
    },
  };
}
