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

function appsKey(apps: Record<string, MonitoredApp>): string {
  return Object.keys(apps).sort().join(',');
}

// ---- shared per-day usage cache ----
// Past days are immutable — cache them so the Today chart, the stats screen, and the per-app
// config chart don't repeat identical full-day native scans. Today is always read fresh.
const dayUsageCache = new Map<number, Record<string, number>>();

export function usageForDay(daysAgo: number): Record<string, number> {
  const start = startOfDayNDaysAgo(daysAgo);
  if (daysAgo === 0) return Native.getUsage(start, Date.now());
  const cached = dayUsageCache.get(start);
  if (cached) return cached;
  const usage = Native.getUsage(start, startOfDayNDaysAgo(daysAgo - 1));
  dayUsageCache.set(start, usage);
  // Keep the cache from growing without bound across many midnights.
  if (dayUsageCache.size > 40) {
    const oldest = Math.min(...dayUsageCache.keys());
    dayUsageCache.delete(oldest);
  }
  return usage;
}

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
    if (!apps[e.packageName]) continue;
    if (e.type === 'shown') attempts[e.packageName] = (attempts[e.packageName] ?? 0) + 1;
    else if (e.type === 'continued') continued[e.packageName] = (continued[e.packageName] ?? 0) + 1;
    else if (e.type === 'dismissed') backedOut[e.packageName] = (backedOut[e.packageName] ?? 0) + 1;
  }

  // Keep raw ms until the end so the total equals the sum users can check by hand.
  let totalMs = 0;
  const perApp: AppStat[] = monitored
    .map((a) => {
      const ms = usage[a.packageName] ?? 0;
      totalMs += ms;
      return {
        packageName: a.packageName,
        label: a.label,
        minutes: Math.round(ms / 60000),
        opens: opens[a.packageName] ?? 0,
        attempts: attempts[a.packageName] ?? 0,
        continued: continued[a.packageName] ?? 0,
        backedOut: backedOut[a.packageName] ?? 0,
      };
    })
    .sort((x, y) => y.minutes - x.minutes || y.attempts - x.attempts);

  return {
    usageAccess,
    perApp,
    totalMinutes: Math.round(totalMs / 60000),
    totalAttempts: perApp.reduce((s, a) => s + a.attempts, 0),
    totalBackedOut: perApp.reduce((s, a) => s + a.backedOut, 0),
    totalContinued: perApp.reduce((s, a) => s + a.continued, 0),
  };
}

// Last computed dashboard, kept per app-set so returning to the tab paints instantly.
let cached: { key: string; data: Dashboard } | null = null;

/**
 * Recompute on demand (call refresh() on screen focus). Paints cheap today-data immediately;
 * the weekly sweep runs one day per macrotask so it never blocks a frame for long.
 */
export function useDashboard(apps: Record<string, MonitoredApp>) {
  const key = appsKey(apps);
  const [data, setData] = useState<Dashboard | null>(cached && cached.key === key ? cached.data : null);
  const gen = useRef(0);

  const refresh = useCallback(() => {
    const today = computeToday(apps);
    const prior = cached && cached.key === key ? cached.data.weekly : [];
    const snapshot: Dashboard = { ...today, weekly: prior };
    cached = { key, data: snapshot };
    setData(snapshot);

    if (!today.usageAccess) return;
    const token = ++gen.current;
    const pkgs = Object.keys(apps);
    const weekly: DayStat[] = [];
    // One day per macrotask: past days usually hit the cache and cost ~nothing.
    const step = (daysAgo: number) => {
      if (token !== gen.current) return; // superseded or unmounted
      const start = startOfDayNDaysAgo(daysAgo);
      const usage = usageForDay(daysAgo);
      let ms = 0;
      for (const pkg of pkgs) ms += usage[pkg] ?? 0;
      weekly.push({ label: DAY_LETTERS[new Date(start).getDay()], minutes: Math.round(ms / 60000) });
      if (daysAgo === 0) {
        const full: Dashboard = { ...today, weekly };
        cached = { key, data: full };
        setData(full);
      } else {
        setTimeout(() => step(daysAgo - 1), 0);
      }
    };
    setTimeout(() => step(6), 50);
  }, [apps, key]);

  useEffect(
    () => () => {
      gen.current++;
    },
    [],
  );

  return { data, refresh };
}

// ---- Pause-event history (from the on-device event log, 30-day retention) ----

export type EventDay = {
  start: number;
  label: string; // "Jul 3"
  dayOfMonth: number;
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
  /** True when the streak filled the whole window — the real streak may be longer. */
  streakCapped: boolean;
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
      dayOfMonth: date.getDate(),
      shown: 0,
      backedOut: 0,
      continued: 0,
    };
    days.push(day);
    dayIndex.set(start, day);
  }

  const perAppMap = new Map<string, { shown: number; backedOut: number; continued: number }>();
  for (const e of events) {
    // History matches the visible per-app rows: watched apps only, so totals always balance.
    if (!apps[e.packageName]) continue;
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
    streakCapped: streak >= numDays,
  };
}

// Session cache shared by the Wins and Attempts screens — same query, no spinner blink.
let historyCache: { key: string; data: EventHistory } | null = null;

export function getCachedHistory(apps: Record<string, MonitoredApp>): EventHistory | null {
  const key = appsKey(apps);
  return historyCache && historyCache.key === key ? historyCache.data : null;
}

export function computeAndCacheHistory(apps: Record<string, MonitoredApp>): EventHistory {
  const data = computeEventHistory(apps);
  historyCache = { key: appsKey(apps), data };
  return data;
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
  const map = new Map<number, { start: number; ms: number; perAppMs: Record<string, number> }>();
  for (const r of rows) {
    if (!pkgs.has(r.packageName)) continue;
    const key = new Date(r.start).setHours(0, 0, 0, 0);
    let b = map.get(key);
    if (!b) {
      b = { start: key, ms: 0, perAppMs: {} };
      map.set(key, b);
    }
    b.ms += r.totalMs;
    b.perAppMs[r.packageName] = (b.perAppMs[r.packageName] ?? 0) + r.totalMs;
  }
  const raw = [...map.values()].sort((a, b) => a.start - b.start);
  const spansYears =
    raw.length > 1 && new Date(raw[0].start).getFullYear() !== new Date(raw[raw.length - 1].start).getFullYear();
  return raw.map((b, i) => {
    const d = new Date(b.start);
    let label: string;
    if (interval === 'weekly') {
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
      label = MONTH_NAMES[d.getMonth()];
      // Two "Jul" bars a year apart would be a lie of omission.
      if (spansYears && (i === 0 || d.getMonth() === 0)) label += ` ’${String(d.getFullYear()).slice(2)}`;
    }
    const perApp: Record<string, number> = {};
    for (const [pkg, ms] of Object.entries(b.perAppMs)) perApp[pkg] = Math.round(ms / 60000);
    return { start: b.start, label, minutes: Math.round(b.ms / 60000), perApp };
  });
}
