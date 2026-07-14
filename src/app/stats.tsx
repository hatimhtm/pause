import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DAY_NAMES, formatMinutes, startOfDayNDaysAgo } from '@/lib/format';
import { Native } from '@/lib/native';
import { computeBuckets, type UsageBucketStat } from '@/lib/stats';
import { useStore } from '@/lib/store';
import type { MonitoredApp } from '@/lib/types';
import { spacing, useAppTheme } from '@/theme';
import { Appear, AppAvatar, BarChart, Body, Card, Chips, Heading, Label, Screen, Spinner, StatTile } from '@/ui/kit';

type Range = 'week' | 'month' | 'year';

type DayData = {
  start: number;
  end: number;
  label: string; // "Mon 13"
  usage: Record<string, number>; // ms per package
  opens: Record<string, number>;
  attempts: Record<string, number>;
  backedOut: Record<string, number>;
  minutes: number; // total across watched apps
};

function computeDays(apps: Record<string, MonitoredApp>, usageAccess: boolean): DayData[] {
  const pkgs = Object.keys(apps);
  const now = Date.now();
  const events = Native.getEvents(startOfDayNDaysAgo(6));
  const out: DayData[] = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const start = startOfDayNDaysAgo(daysAgo);
    const end = daysAgo === 0 ? now : startOfDayNDaysAgo(daysAgo - 1);
    const usage = usageAccess ? Native.getUsage(start, end) : {};
    const opens = usageAccess ? Native.getOpens(start, end) : {};
    const attempts: Record<string, number> = {};
    const backedOut: Record<string, number> = {};
    for (const e of events) {
      if (e.timestamp < start || e.timestamp >= end) continue;
      if (e.type === 'shown') attempts[e.packageName] = (attempts[e.packageName] ?? 0) + 1;
      else if (e.type === 'dismissed') backedOut[e.packageName] = (backedOut[e.packageName] ?? 0) + 1;
    }
    const d = new Date(start);
    out.push({
      start,
      end,
      label: `${DAY_NAMES[d.getDay()]} ${d.getDate()}`,
      usage,
      opens,
      attempts,
      backedOut,
      minutes: Math.round(pkgs.reduce((s, p) => s + (usage[p] ?? 0), 0) / 60000),
    });
  }
  return out;
}

// Session cache: reopening the screen paints instantly, fresh numbers replace it right after.
let daysCache: DayData[] | null = null;

export default function StatsScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { apps } = useStore();
  const [range, setRange] = useState<Range>('week');
  const [selected, setSelected] = useState(6); // today
  const [days, setDays] = useState<DayData[] | null>(daysCache);
  const [buckets, setBuckets] = useState<Partial<Record<'month' | 'year', UsageBucketStat[]>>>({});
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const usageAccess = Native.hasUsageAccess();

  const compute = useCallback(() => {
    const d = computeDays(apps, usageAccess);
    daysCache = d;
    setDays(d);
  }, [apps, usageAccess]);

  // The 7-day sweep is the expensive query — keep it off the first paint.
  useEffect(() => {
    const t = setTimeout(compute, 40);
    return () => clearTimeout(t);
  }, [compute]);

  // Month/year buckets load lazily the first time their tab is opened.
  useEffect(() => {
    if (range === 'week' || buckets[range]) return;
    const t = setTimeout(() => {
      const b = computeBuckets(apps, range === 'month' ? 'weekly' : 'monthly');
      setBuckets((prev) => ({ ...prev, [range]: b }));
      setSelectedBucket(b.length > 0 ? b.length - 1 : null);
    }, 40);
    return () => clearTimeout(t);
  }, [range, apps, buckets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      compute();
      setBuckets({});
      setRefreshing(false);
    }, 60);
  }, [compute]);

  const weekMinutes = (days ?? []).reduce((s, d) => s + d.minutes, 0);
  const weekBackedOut = (days ?? []).reduce(
    (s, d) => s + Object.values(d.backedOut).reduce((a, b) => a + b, 0),
    0,
  );
  const day = days?.[selected];
  const dayApps = day
    ? Object.values(apps)
        .map((a) => ({
          packageName: a.packageName,
          label: a.label,
          icon: a.icon,
          minutes: Math.round((day.usage[a.packageName] ?? 0) / 60000),
          opens: day.opens[a.packageName] ?? 0,
          attempts: day.attempts[a.packageName] ?? 0,
          backedOut: day.backedOut[a.packageName] ?? 0,
        }))
        .filter((a) => a.minutes > 0 || a.opens > 0 || a.attempts > 0)
        .sort((x, y) => y.minutes - x.minutes)
    : [];

  const activeBuckets = range === 'week' ? null : buckets[range];
  const bucket =
    activeBuckets && selectedBucket != null && activeBuckets[selectedBucket]
      ? activeBuckets[selectedBucket]
      : null;
  const bucketApps = bucket
    ? Object.values(apps)
        .map((a) => ({
          packageName: a.packageName,
          label: a.label,
          icon: a.icon,
          minutes: bucket.perApp[a.packageName] ?? 0,
        }))
        .filter((a) => a.minutes > 0)
        .sort((x, y) => y.minutes - x.minutes)
    : [];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Appear index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.md }}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Heading style={{ fontSize: 22, flex: 1 }}>Your time</Heading>
        </View>
        <View style={{ marginBottom: spacing.lg }}>
          <Chips
            options={['week', 'month', 'year'] as Range[]}
            value={range}
            onChange={setRange}
            format={(r) => (r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'Year')}
          />
        </View>
      </Appear>

      {range === 'week' ? (
        !days ? (
          <Spinner />
        ) : (
          <>
            <Appear index={1}>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <StatTile
                  value={usageAccess ? formatMinutes(weekMinutes) : '—'}
                  label="on watched apps this week"
                  icon="hourglass"
                  tone="primary"
                />
                <StatTile value={String(weekBackedOut)} label="times you walked away" icon="walk" />
              </View>
            </Appear>

            {!usageAccess ? (
              <Appear index={2}>
                <Card onPress={() => router.push('/onboarding')} style={{ marginTop: spacing.md }}>
                  <Body dim>Turn on Usage Access to see time spent per app and per day.</Body>
                </Card>
              </Appear>
            ) : null}

            <Appear index={2}>
              <Card style={{ marginTop: spacing.md }}>
                <Heading style={{ fontSize: 16, marginBottom: spacing.xs }}>Day by day</Heading>
                <Body faint style={{ fontSize: 12.5, marginBottom: spacing.md }}>
                  Tap a day to see where the time went.
                </Body>
                <BarChart
                  values={days.map((d) => d.minutes)}
                  labels={days.map((d) => d.label.slice(0, 3))}
                  activeIndex={selected}
                  onBarPress={setSelected}
                  formatValue={(v) => formatMinutes(v)}
                />
              </Card>
            </Appear>

            <Appear index={3}>
              <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
                {selected === 6 ? 'Today' : day?.label}
              </Label>
            </Appear>
            {dayApps.length === 0 ? (
              <Appear index={4}>
                <Card>
                  <Body dim>
                    {usageAccess
                      ? 'Nothing recorded on your watched apps this day.'
                      : 'No pause activity recorded this day.'}
                  </Body>
                </Card>
              </Appear>
            ) : (
              dayApps.map((a, i) => (
                <Appear key={a.packageName} index={4 + i}>
                  <Card
                    onPress={() => router.push(`/config/${a.packageName}`)}
                    style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <AppAvatar icon={a.icon} />
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Heading style={{ fontSize: 16 }}>{a.label}</Heading>
                        <Body faint style={{ fontSize: 12.5 }}>
                          {a.opens} opens · {a.attempts} paused · {a.backedOut} backed out
                        </Body>
                      </View>
                      <Heading style={{ fontSize: 16 }}>{usageAccess ? formatMinutes(a.minutes) : '—'}</Heading>
                    </View>
                  </Card>
                </Appear>
              ))
            )}
          </>
        )
      ) : !activeBuckets ? (
        <Spinner />
      ) : activeBuckets.length === 0 ? (
        <Appear index={1}>
          <Card>
            <Heading style={{ fontSize: 16, marginBottom: spacing.xs }}>No long-range data yet</Heading>
            <Body dim style={{ fontSize: 13.5 }}>
              Longer history needs the latest Pause version (v1.2+) and builds up as Android
              collects it — weeks appear after a few weeks, months after a few months. Check back
              soon.
            </Body>
          </Card>
        </Appear>
      ) : (
        <>
          <Appear index={1}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile
                value={formatMinutes(activeBuckets.reduce((s, b) => s + b.minutes, 0))}
                label={range === 'month' ? 'across these weeks' : 'across these months'}
                icon="hourglass"
                tone="primary"
              />
              <StatTile
                value={formatMinutes(Math.round(activeBuckets.reduce((s, b) => s + b.minutes, 0) / activeBuckets.length))}
                label={range === 'month' ? 'average per week' : 'average per month'}
                icon="analytics"
              />
            </View>
          </Appear>

          <Appear index={2}>
            <Card style={{ marginTop: spacing.md }}>
              <Heading style={{ fontSize: 16, marginBottom: spacing.xs }}>
                {range === 'month' ? 'Week by week' : 'Month by month'}
              </Heading>
              <Body faint style={{ fontSize: 12.5, marginBottom: spacing.md }}>
                {range === 'month'
                  ? 'Tap a week to see where the time went.'
                  : 'Tap a month to see where the time went.'}
              </Body>
              <BarChart
                values={activeBuckets.map((b) => b.minutes)}
                labels={activeBuckets.map((b) => b.label)}
                activeIndex={selectedBucket ?? undefined}
                onBarPress={setSelectedBucket}
                formatValue={(v) => formatMinutes(v)}
              />
            </Card>
          </Appear>

          {bucket ? (
            <>
              <Appear index={3}>
                <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
                  {range === 'month' ? `Week of ${bucket.label}` : bucket.label}
                </Label>
              </Appear>
              {bucketApps.length === 0 ? (
                <Appear index={4}>
                  <Card>
                    <Body dim>Nothing recorded on your watched apps in this period.</Body>
                  </Card>
                </Appear>
              ) : (
                bucketApps.map((a, i) => (
                  <Appear key={a.packageName} index={4 + i}>
                    <Card
                      onPress={() => router.push(`/config/${a.packageName}`)}
                      style={{ marginBottom: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <AppAvatar icon={a.icon} />
                        <Heading style={{ fontSize: 16, flex: 1, marginLeft: spacing.md }}>{a.label}</Heading>
                        <Heading style={{ fontSize: 16 }}>{formatMinutes(a.minutes)}</Heading>
                      </View>
                    </Card>
                  </Appear>
                ))
              )}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
