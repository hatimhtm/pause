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

// ---- Pause-event history (from the on-device event log, 30-day retention) ----

export type EventDay = {
  start: number;
  label: string; // "Jul 3"
  shown: number;
  backedOut: number;
  continued: number;
};

export type EventHistory = {
  days: EventDay[]; // oldest → newest
  perApp: {
    packageName: string;
    label: string;
    icon: string | null;
    shown: number;
    backedOut: number;
    continued: number;
  }[];
  totals: { shown: number; backedOut: number; continued: number };
  /** Consecutive days ending now with at least one walk-away (today may still be 0). */
  streak: number;
};

export function computeEventHistory(apps: Record<string, MonitoredApp>, numDays = 30): EventHistory {
  const events = Native.getEvents(startOfDayNDaysAgo(numDays - 1));
  const days: EventDay[] = [];
  const dayIndex = new Map<number, EventDay>();
  for (let d = numDays - 1; d >= 0; d--) {
    const start = startOfDayNDaysAgo(d);
    const date = new Date(start);
    const day: EventDay = {
      start,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      shown: 0,
      backedOut: 0,
      continued: 0,
    };
    days.push(day);
    dayIndex.set(start, day);
  }

  const perAppMap = new Map<string, { shown: number; backedOut: number; continued: number }>();
  for (const e of events) {
    const dayStart = new Date(e.timestamp).setHours(0, 0, 0, 0);
    const day = dayIndex.get(dayStart);
    const app = (perAppMap.get(e.packageName) ??
      perAppMap.set(e.packageName, { shown: 0, backedOut: 0, continued: 0 }).get(e.packageName))!;
    if (e.type === 'shown') {
      if (day) day.shown++;
      app.shown++;
    } else if (e.type === 'dismissed') {
      if (day) day.backedOut++;
      app.backedOut++;
    } else if (e.type === 'continued') {
      if (day) day.continued++;
      app.continued++;
    }
  }

  const perApp = Object.values(apps)
    .map((a) => ({
      packageName: a.packageName,
      label: a.label,
      icon: a.icon,
      ...(perAppMap.get(a.packageName) ?? { shown: 0, backedOut: 0, continued: 0 }),
    }))
    .sort((x, y) => y.shown - x.shown);

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].backedOut > 0) streak++;
    else if (i === days.length - 1) continue; // today isn't over yet — don't break on it
    else break;
  }

  return {
    days,
    perApp,
    totals: {
      shown: days.reduce((s, d) => s + d.shown, 0),
      backedOut: days.reduce((s, d) => s + d.backedOut, 0),
      continued: days.reduce((s, d) => s + d.continued, 0),
    },
    streak,
  };
}

// ---- Long-range usage buckets (Android's pre-aggregated tiers; needs the v1.2+ engine) ----

export type UsageBucketStat = {
  start: number;
  label: string;
  minutes: number;
  perApp: Record<string, number>; // minutes
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeBuckets(
  apps: Record<string, MonitoredApp>,
  interval: 'weekly' | 'monthly',
): UsageBucketStat[] {
  const pkgs = new Set(Object.keys(apps));
  const now = Date.now();
  const span = interval === 'weekly' ? 60 : 400; // days back; the OS returns what it kept
  const rows = Native.getUsageHistory(interval, now - span * 24 * 60 * 60 * 1000, now);
  const map = new Map<number, UsageBucketStat>();
  for (const r of rows) {
    if (!pkgs.has(r.packageName)) continue;
    const key = new Date(r.start).setHours(0, 0, 0, 0);
    let b = map.get(key);
    if (!b) {
      b = { start: key, label: '', minutes: 0, perApp: {} };
      map.set(key, b);
    }
    b.minutes += r.totalMs / 60000;
    b.perApp[r.packageName] = (b.perApp[r.packageName] ?? 0) + r.totalMs / 60000;
  }
  const out = [...map.values()].sort((a, b) => a.start - b.start);
  for (const b of out) {
    const d = new Date(b.start);
    b.label =
      interval === 'weekly'
        ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : MONTH_NAMES[d.getMonth()];
    b.minutes = Math.round(b.minutes);
    for (const k of Object.keys(b.perApp)) b.perApp[k] = Math.round(b.perApp[k]);
  }
  return out;
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
