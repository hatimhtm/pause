export type InstalledApp = {
  packageName: string;
  label: string;
  isSystem: boolean;
  icon: string | null; // data: URI
};

export type MonitoredApp = {
  packageName: string;
  label: string;
  icon: string | null; // data: URI, cached from the picker
  enabled: boolean; // show the breathing pause
  breathSeconds: number;
  reflection: boolean; // "why are you opening it?"
  muteNotifications: boolean;
  addedAt: number;
};

export type QuietHours = {
  id: string;
  label: string;
  startMinute: number; // minutes into the day
  endMinute: number;
  daysMask: number; // bit 0 = Sunday .. bit 6 = Saturday
  enabled: boolean;
};

export type BreathStyle = {
  title: string;
  reflection: string;
  continueLabel: string;
  dismissLabel: string;
  colorTop: string;
  colorBottom: string;
  colorAccent: string;
};

export type Settings = {
  onboardingComplete: boolean;
  sessionMinutes: number;
  defaultBreathSeconds: number;
  haptics: boolean;
};

export type PauseState = {
  apps: Record<string, MonitoredApp>;
  quiet: QuietHours[];
  settings: Settings;
  breath: BreathStyle;
};

export type LoggedEvent = {
  packageName: string;
  timestamp: number;
  type: 'shown' | 'continued' | 'dismissed';
};
