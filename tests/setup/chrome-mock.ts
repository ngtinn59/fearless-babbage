/**
 * In-memory mock for chrome APIs: storage, proxy, action, runtime, notifications, webRequest.
 */

type StorageChange = chrome.storage.StorageChange;
type StorageListener = (changes: { [key: string]: StorageChange }, areaName: string) => void;

export interface ProxyErrorDetails {
  error: string;
  details: string;
  fatal: boolean;
}

export interface NotificationOptions {
  type: string;
  iconUrl?: string;
  title: string;
  message: string;
}

export interface ChromeMockController {
  reset(): void;
  getRaw(area: 'local' | 'session'): Record<string, unknown>;
  setRaw(area: 'local' | 'session', key: string, value: unknown): void;
  action: {
    getBadgeText(): string;
    getBadgeBackgroundColor(): string | number[];
  };
  proxy: {
    getSettings(): chrome.proxy.ProxyConfig | null;
    setLevelOfControl(level: chrome.types.LevelOfControl): void;
    dispatchProxyError(details: ProxyErrorDetails): void;
  };
  notifications: {
    getCreated(): NotificationOptions[];
  };
  runtime: {
    dispatchInstalled(): void;
    dispatchStartup(): void;
  };
}

export type ChromeStorageMockController = ChromeMockController;

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

class EventDispatcher<T> {
  private listeners = new Set<(arg: T) => void>();

  addListener(listener: (arg: T) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (arg: T) => void): void {
    this.listeners.delete(listener);
  }

  hasListener(listener: (arg: T) => void): boolean {
    return this.listeners.has(listener);
  }

  dispatch(arg: T): void {
    for (const l of Array.from(this.listeners)) {
      try {
        l(arg);
      } catch (err) {
        console.error('Event listener error:', err);
      }
    }
  }

  _reset(): void {
    this.listeners.clear();
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

export function installChromeMock(): ChromeMockController {
  const changedEvent = new StorageChangedEvent();
  const installedEvent = new EventDispatcher<void>();
  const startupEvent = new EventDispatcher<void>();
  const proxyErrorEvent = new EventDispatcher<ProxyErrorDetails>();

  const notify = (changes: Record<string, StorageChange>, areaName: string) => {
    changedEvent.dispatch(changes, areaName);
  };

  const localArea = new MemoryStorageArea('local', notify);
  const sessionArea = new MemoryStorageArea('session', notify);

  let badgeText = '';
  let badgeColor: string | number[] = '';

  let proxySettingsValue: chrome.proxy.ProxyConfig | null = null;
  let levelOfControl: chrome.types.LevelOfControl = 'controllable_by_this_extension';

  const createdNotifications: NotificationOptions[] = [];

  const mockChrome = {
    ...(globalThis.chrome || {}),
    storage: {
      local: localArea,
      session: sessionArea,
      onChanged: changedEvent,
    },
    action: {
      async setBadgeText(details: { text: string }): Promise<void> {
        badgeText = details.text;
      },
      async setBadgeBackgroundColor(details: { color: string | number[] }): Promise<void> {
        badgeColor = details.color;
      },
      async setBadgeTextColor(): Promise<void> {
        // no-op mock
      },
    },
    proxy: {
      settings: {
        async set(details: { value: chrome.proxy.ProxyConfig; scope?: string }): Promise<void> {
          proxySettingsValue = details.value;
        },
        async get(): Promise<{ value: chrome.proxy.ProxyConfig | null; levelOfControl: chrome.types.LevelOfControl }> {
          return {
            value: proxySettingsValue,
            levelOfControl,
          };
        },
        async clear(): Promise<void> {
          proxySettingsValue = null;
        },
      },
      onProxyError: proxyErrorEvent,
    },
    notifications: {
      async create(options: NotificationOptions): Promise<string> {
        createdNotifications.push(options);
        return 'notif-' + createdNotifications.length;
      },
    },
    runtime: {
      onInstalled: installedEvent,
      onStartup: startupEvent,
    },
    i18n: {
      getMessage(key: string): string {
        if (key === 'extName') return 'Smart Proxy';
        return key;
      },
    },
  };

  // @ts-expect-error Mocking global chrome
  globalThis.chrome = mockChrome;

  return {
    reset() {
      localArea._reset();
      sessionArea._reset();
      changedEvent._reset();
      installedEvent._reset();
      startupEvent._reset();
      proxyErrorEvent._reset();
      badgeText = '';
      badgeColor = '';
      proxySettingsValue = null;
      levelOfControl = 'controllable_by_this_extension';
      createdNotifications.length = 0;
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
    action: {
      getBadgeText: () => badgeText,
      getBadgeBackgroundColor: () => badgeColor,
    },
    proxy: {
      getSettings: () => proxySettingsValue,
      setLevelOfControl: (lvl) => {
        levelOfControl = lvl;
      },
      dispatchProxyError: (d) => proxyErrorEvent.dispatch(d),
    },
    notifications: {
      getCreated: () => [...createdNotifications],
    },
    runtime: {
      dispatchInstalled: () => installedEvent.dispatch(),
      dispatchStartup: () => startupEvent.dispatch(),
    },
  };
}
