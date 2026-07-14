import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { CURRENT_CHANGELOG_ID } from './changelog';
import { Native } from './native';
import type { BreathStyle, MonitoredApp, PauseState, QuietHours, Settings } from './types';

const STORAGE_KEY = 'pause.state.v1';
// App icons (base64 data URIs, ~KBs each) live under their own key so the hot path —
// persisting a settings change — never re-serializes them.
const ICONS_KEY = 'pause.icons.v1';

/** Anything shorter is easy to sit through on autopilot — the pause has to cost something. */
export const MIN_BREATH_SECONDS = 15;
const EVENT_RETENTION_DAYS = 30;
const PERSIST_DEBOUNCE_MS = 350;

const defaultBreath: BreathStyle = {
  title: 'Take a breath',
  reflection: 'Why are you opening it?',
  continueLabel: 'Open {app} anyway',
  dismissLabel: 'Not now — close it',
  colorTop: '#06403F',
  colorBottom: '#0E7C7B',
  colorAccent: '#BFE3E2',
};

const defaultSettings: Settings = {
  onboardingComplete: false,
  sessionMinutes: 5,
  defaultBreathSeconds: MIN_BREATH_SECONDS,
  haptics: true,
};

const initialState: PauseState = {
  apps: {},
  quiet: [],
  settings: defaultSettings,
  breath: defaultBreath,
};

let state: PauseState = initialState;
let hydrated = false;
// When the stored state could not be read, never write: a persist would replace the user's
// real config (and native's copy) with defaults. Native keeps its own last-good config, so
// interventions keep working through a bad launch.
let storeCompromised = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function toNativeConfig(s: PauseState): string {
  const apps: Record<string, unknown> = {};
  for (const app of Object.values(s.apps)) {
    apps[app.packageName] = {
      label: app.label,
      breathSeconds: app.breathSeconds,
      reflection: app.reflection,
      muteNotifications: app.muteNotifications,
      enabled: app.enabled,
    };
  }
  return JSON.stringify({
    sessionMinutes: s.settings.sessionMinutes,
    haptics: s.settings.haptics,
    breath: s.breath,
    apps,
    quietHours: s.quiet.map((q) => ({
      startMinute: q.startMinute,
      endMinute: q.endMinute,
      daysMask: q.daysMask,
      enabled: q.enabled,
    })),
  });
}

function stripIcons(s: PauseState): PauseState {
  const apps: PauseState['apps'] = {};
  for (const [pkg, app] of Object.entries(s.apps)) apps[pkg] = { ...app, icon: null };
  return { ...s, apps };
}

async function persistNow() {
  if (storeCompromised) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stripIcons(state)));
  } catch {}
  Native.setConfig(toNativeConfig(state));
}

async function persistIcons() {
  if (storeCompromised) return;
  try {
    const icons: Record<string, string> = {};
    for (const app of Object.values(state.apps)) if (app.icon) icons[app.packageName] = app.icon;
    await AsyncStorage.setItem(ICONS_KEY, JSON.stringify(icons));
  } catch {}
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, PERSIST_DEBOUNCE_MS);
}

function set(next: PauseState) {
  state = next;
  emit();
  schedulePersist();
}

/** Raise any pause length saved before the 15-second floor existed. */
function clampBreathSeconds(s: PauseState): PauseState {
  const apps: PauseState['apps'] = {};
  for (const [pkg, app] of Object.entries(s.apps)) {
    apps[pkg] = { ...app, breathSeconds: Math.max(MIN_BREATH_SECONDS, app.breathSeconds) };
  }
  return {
    ...s,
    apps,
    settings: {
      ...s.settings,
      defaultBreathSeconds: Math.max(MIN_BREATH_SECONDS, s.settings.defaultBreathSeconds),
    },
  };
}

async function readState(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY); // throws -> caller marks compromised
  if (raw) {
    const parsed = JSON.parse(raw) as Partial<PauseState>;
    let icons: Record<string, string> = {};
    try {
      icons = JSON.parse((await AsyncStorage.getItem(ICONS_KEY)) ?? '{}');
    } catch {}
    const apps: PauseState['apps'] = {};
    for (const [pkg, app] of Object.entries(parsed.apps ?? {})) {
      apps[pkg] = { ...app, icon: app.icon ?? icons[pkg] ?? null };
    }
    state = clampBreathSeconds({
      apps,
      quiet: parsed.quiet ?? [],
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      breath: { ...defaultBreath, ...(parsed.breath ?? {}) },
    });
  }
  return true; // raw === null is a genuine fresh install — safe to persist defaults
}

export async function hydrate() {
  if (hydrated) return;
  let readOk = false;
  try {
    readOk = await readState();
  } catch {
    // One retry — cold-start storage hiccups are usually transient.
    await new Promise((r) => setTimeout(r, 500));
    try {
      readOk = await readState();
    } catch {}
  }
  storeCompromised = !readOk;
  hydrated = true;
  emit();
  if (readOk) {
    // Persist any clamping and make sure native has the latest config even on a cold start.
    void persistNow();
    void persistIcons();
    // The event log has no other janitor — trim it on every cold start.
    Native.pruneEventsBefore(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  }
}

// ---- mutations ----

export const actions = {
  addApp(packageName: string, label: string, icon: string | null = null) {
    if (state.apps[packageName]) return;
    const app: MonitoredApp = {
      packageName,
      label,
      icon,
      enabled: true,
      breathSeconds: state.settings.defaultBreathSeconds,
      reflection: true,
      muteNotifications: false,
      addedAt: Date.now(),
    };
    set({ ...state, apps: { ...state.apps, [packageName]: app } });
    void persistIcons();
  },
  removeApp(packageName: string) {
    const apps = { ...state.apps };
    delete apps[packageName];
    set({ ...state, apps });
    void persistIcons();
  },
  updateApp(packageName: string, patch: Partial<MonitoredApp>) {
    const current = state.apps[packageName];
    if (!current) return;
    set({ ...state, apps: { ...state.apps, [packageName]: { ...current, ...patch } } });
  },
  upsertQuiet(q: QuietHours) {
    const idx = state.quiet.findIndex((x) => x.id === q.id);
    const quiet = idx >= 0 ? state.quiet.map((x) => (x.id === q.id ? q : x)) : [...state.quiet, q];
    set({ ...state, quiet });
  },
  removeQuiet(id: string) {
    set({ ...state, quiet: state.quiet.filter((q) => q.id !== id) });
  },
  updateSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch } });
  },
  updateBreath(patch: Partial<BreathStyle>) {
    set({ ...state, breath: { ...state.breath, ...patch } });
  },
  completeOnboarding() {
    // A fresh install shouldn't be greeted with "what's new" — mark the current entry seen.
    set({
      ...state,
      settings: {
        ...state.settings,
        onboardingComplete: true,
        lastSeenChangelog: CURRENT_CHANGELOG_ID,
      },
    });
  },
};

export function newQuietId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ---- react bindings ----

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore(): PauseState {
  return useSyncExternalStore(subscribe, () => state);
}

/**
 * Subscribe to a slice. useSyncExternalStore bails out when the selected snapshot is
 * Object.is-equal, so screens stop re-rendering on unrelated mutations. The selector must
 * return something referentially stable (a state slice), not a fresh object.
 */
export function useStoreSelector<T>(selector: (s: PauseState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => hydrated);
}

/** Non-reactive snapshot for imperative code (haptics, logging). */
export function currentState(): PauseState {
  return state;
}
