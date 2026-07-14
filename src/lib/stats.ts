import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Today-only numbers — three native reads, cheap enough to run on the JS thread at paint time. */
function computeToday(apps: Record<string, MonitoredApp>): Omit<Dashboard, 'weekly'> {
  const usageAccess = Native.hasUsageAccess();
  const monitored = Object.values(apps);
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

  return {
    usageAccess,
    perApp,
    totalMinutes: perApp.reduce((s, a) => s + a.minutes, 0),
    totalAttempts: perApp.reduce((s, a) => s + a.attempts, 0),
    totalBackedOut: perApp.reduce((s, a) => s + a.backedOut, 0),
    totalContinued: perApp.reduce((s, a) => s + a.continued, 0),
  };
}

/** Seven full-day usage scans — the expensive part; keep it off the first paint. */
function computeWeekly(apps: Record<string, MonitoredApp>): DayStat[] {
  if (!Native.hasUsageAccess()) return [];
  const pkgs = Object.keys(apps);
  const now = Date.now();
  const weekly: DayStat[] = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const start = startOfDayNDaysAgo(daysAgo);
    const end = daysAgo === 0 ? now : startOfDayNDaysAgo(daysAgo - 1);
    const dayUsage = Native.getUsage(start, end);
    let minutes = 0;
    for (const pkg of pkgs) minutes += (dayUsage[pkg] ?? 0) / 60000;
    weekly.push({ label: DAY_LETTERS[new Date(start).getDay()], minutes: Math.round(minutes) });
  }
  return weekly;
}

// Last computed dashboard, kept for the session so returning to the tab paints instantly
// with yesterday's-second data while fresh numbers are computed.
let cached: Dashboard | null = null;

/** Recompute on demand (call refresh() on screen focus). Paints cheap data now, weekly async. */
export function useDashboard(apps: Record<string, MonitoredApp>) {
  const [data, setData] = useState<Dashboard | null>(cached);
  const gen = useRef(0);

  const refresh = useCallback(() => {
    const today = computeToday(apps);
    const snapshot: Dashboard = { ...today, weekly: cached?.weekly ?? [] };
    cached = snapshot;
    setData(snapshot);
    const token = ++gen.current;
    setTimeout(() => {
      if (token !== gen.current) return; // superseded or unmounted
      const full: Dashboard = { ...today, weekly: computeWeekly(apps) };
      cached = full;
      setData(full);
    }, 60);
  }, [apps]);

  useEffect(
    () => () => {
      gen.current++;
    },
    [],
  );

  return { data, refresh };
}
