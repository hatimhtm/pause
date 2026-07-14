import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { InstalledApp, LoggedEvent } from './types';

export type UsageBucket = {
  packageName: string;
  start: number;
  end: number;
  totalMs: number;
};

/**
 * Typed wrapper around the local `PauseNative` Kotlin module. On any non-Android platform (iOS
 * simulator, web during development) the module is absent, so every call falls back to a safe
 * no-op / empty result and the UI still renders.
 */
type PauseNativeModule = {
  isAccessibilityEnabled(): boolean;
  isServiceRunning(): boolean;
  hasUsageAccess(): boolean;
  isNotificationAccessEnabled(): boolean;
  openAccessibilitySettings(): void;
  openUsageAccessSettings(): void;
  openNotificationAccessSettings(): void;
  setConfig(json: string): void;
  getInstalledApps(): Promise<InstalledApp[]>;
  getUsage(start: number, end: number): Record<string, number>;
  getOpens(start: number, end: number): Record<string, number>;
  getUsageHistory(
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    start: number,
    end: number,
  ): UsageBucket[];
  getEvents(since: number): { packageName: string; timestamp: number; type: string }[];
  pruneEventsBefore(before: number): void;
};

const native = requireOptionalNativeModule<PauseNativeModule>('PauseNative');

export const isSupported = Platform.OS === 'android' && native != null;

export const Native = {
  isAccessibilityEnabled: () => native?.isAccessibilityEnabled() ?? false,
  isServiceRunning: () => native?.isServiceRunning() ?? false,
  hasUsageAccess: () => native?.hasUsageAccess() ?? false,
  isNotificationAccessEnabled: () => native?.isNotificationAccessEnabled() ?? false,

  openAccessibilitySettings: () => native?.openAccessibilitySettings(),
  openUsageAccessSettings: () => native?.openUsageAccessSettings(),
  openNotificationAccessSettings: () => native?.openNotificationAccessSettings(),

  setConfig: (json: string) => native?.setConfig(json),

  getInstalledApps: async (): Promise<InstalledApp[]> => (await native?.getInstalledApps()) ?? [],

  getUsage: (start: number, end: number): Record<string, number> =>
    native?.getUsage(start, end) ?? {},
  getOpens: (start: number, end: number): Record<string, number> =>
    native?.getOpens(start, end) ?? {},
  /** Optional-chained per method: APKs older than v1.2 don't have it — callers get []. */
  getUsageHistory: (
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    start: number,
    end: number,
  ): UsageBucket[] => {
    try {
      return native?.getUsageHistory?.(interval, start, end) ?? [];
    } catch {
      return [];
    }
  },
  getEvents: (since: number): LoggedEvent[] =>
    (native?.getEvents(since) ?? []) as LoggedEvent[],
  pruneEventsBefore: (before: number) => native?.pruneEventsBefore(before),
};
