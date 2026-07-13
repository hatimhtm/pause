import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { Native } from './native';
import type { BreathStyle, MonitoredApp, PauseState, QuietHours, Settings } from './types';

const STORAGE_KEY = 'pause.state.v1';

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
  defaultBreathSeconds: 8,
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

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
  Native.setConfig(toNativeConfig(state));
}

function set(next: PauseState) {
  state = next;
  emit();
  void persist();
}

export async function hydrate() {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PauseState>;
      state = {
        apps: parsed.apps ?? {},
        quiet: parsed.quiet ?? [],
        settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
        breath: { ...defaultBreath, ...(parsed.breath ?? {}) },
      };
    }
  } catch {}
  hydrated = true;
  emit();
  // Make sure native has the latest config even on a cold start.
  Native.setConfig(toNativeConfig(state));
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
  },
  removeApp(packageName: string) {
    const apps = { ...state.apps };
    delete apps[packageName];
    set({ ...state, apps });
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
    set({ ...state, settings: { ...state.settings, onboardingComplete: true } });
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

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => hydrated);
}
