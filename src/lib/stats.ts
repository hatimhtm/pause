import { useCallback, useState } from 'react';

import { Native } from './native';
import { DAY_LETTERS, startOfDayNDaysAgo, startOfToday } from './format';
import type { MonitoredApp } from './types';

export type AppStat = {
  packageName: string;
  label: string;
  minutes: number;
  opens: number; // system-level foreground entries
  attempts: number; // times the pause screen appeared
  continued: number;
  backedOut: number;
};

export type DayStat = { label: string; minutes: number };

export type Dashboard = {
  usageAccess: boolean;
  perApp: AppStat[];
  totalMinutes: number;
  totalAttempts: number;
  totalBackedOut: number;
  totalContinued: number;
  weekly: DayStat[];
};

export function computeDashboard(apps: Record<string, MonitoredApp>): Dashboard {
  const usageAccess = Native.hasUsageAccess();
  const monitored = Object.values(apps);
  const pkgs = new Set(monitored.map((a) => a.packageName));
  const todayStart = startOfToday();
  const now = Date.now();

  const usage = usageAccess ? Native.getUsage(todayStart, now) : {};
  const opens = usageAccess ? Native.getOpens(todayStart, now) : {};
  const events = Native.getEvents(todayStart);

  const attempts: Record<string, number> = {};
  const continued: Record<string, number> = {};
  const backedOut: Record<string, number> = {};
  for (const e of events) {
    if (e.type === 'shown') attempts[e.packageName] = (attempts[e.packageName] ?? 0) + 1;
    else if (e.type === 'continued') continued[e.packageName] = (continued[e.packageName] ?? 0) + 1;
    else if (e.type === 'dismissed') backedOut[e.packageName] = (backedOut[e.packageName] ?? 0) + 1;
  }

  const perApp: AppStat[] = monitored
    .map((a) => ({
      packageName: a.packageName,
      label: a.label,
      minutes: Math.round((usage[a.packageName] ?? 0) / 60000),
      opens: opens[a.packageName] ?? 0,
      attempts: attempts[a.packageName] ?? 0,
      continued: continued[a.packageName] ?? 0,
      backedOut: backedOut[a.packageName] ?? 0,
    }))
    .sort((x, y) => y.minutes - x.minutes || y.attempts - x.attempts);

  const weekly: DayStat[] = [];
  if (usageAccess) {
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const start = startOfDayNDaysAgo(daysAgo);
      const end = daysAgo === 0 ? now : startOfDayNDaysAgo(daysAgo - 1);
      const dayUsage = Native.getUsage(start, end);
      let minutes = 0;
      for (const pkg of pkgs) minutes += (dayUsage[pkg] ?? 0) / 60000;
      const dow = new Date(start).getDay();
      weekly.push({ label: DAY_LETTERS[dow], minutes: Math.round(minutes) });
    }
  }

  return {
    usageAccess,
    perApp,
    totalMinutes: perApp.reduce((s, a) => s + a.minutes, 0),
    totalAttempts: perApp.reduce((s, a) => s + a.attempts, 0),
    totalBackedOut: perApp.reduce((s, a) => s + a.backedOut, 0),
    totalContinued: perApp.reduce((s, a) => s + a.continued, 0),
    weekly,
  };
}

/** Recompute on demand (call refresh() on screen focus). Native reads are synchronous. */
export function useDashboard(apps: Record<string, MonitoredApp>) {
  const [data, setData] = useState<Dashboard | null>(null);
  const refresh = useCallback(() => {
    setData(computeDashboard(apps));
  }, [apps]);
  return { data, refresh };
}
