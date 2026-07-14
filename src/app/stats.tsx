import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DAY_NAMES, formatMinutes, startOfDayNDaysAgo } from '@/lib/format';
import { Native } from '@/lib/native';
import { useStore } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import { AppAvatar, BarChart, Body, Card, Heading, Label, Screen, StatTile } from '@/ui/kit';

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

export default function StatsScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { apps } = useStore();
  const [selected, setSelected] = useState(6); // today

  const usageAccess = Native.hasUsageAccess();

  const days = useMemo<DayData[]>(() => {
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
  }, [apps, usageAccess]);

  const weekMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const weekBackedOut = days.reduce(
    (s, d) => s + Object.values(d.backedOut).reduce((a, b) => a + b, 0),
    0,
  );
  const day = days[selected];
  const dayApps = Object.values(apps)
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
    .sort((x, y) => y.minutes - x.minutes);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.md }}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <Heading style={{ fontSize: 22 }}>Your week</Heading>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile
          value={usageAccess ? formatMinutes(weekMinutes) : '—'}
          label="on watched apps this week"
          icon="hourglass"
          tone="primary"
        />
        <StatTile value={String(weekBackedOut)} label="times you walked away" icon="walk" />
      </View>

      {!usageAccess ? (
        <Card onPress={() => router.push('/onboarding')} style={{ marginTop: spacing.md }}>
          <Body dim>Turn on Usage Access to see time spent per app and per day.</Body>
        </Card>
      ) : null}

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

      <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
        {selected === 6 ? 'Today' : day.label}
      </Label>
      {dayApps.length === 0 ? (
        <Card>
          <Body dim>
            {usageAccess
              ? 'Nothing recorded on your watched apps this day.'
              : 'No pause activity recorded this day.'}
          </Body>
        </Card>
      ) : (
        dayApps.map((a) => (
          <Card
            key={a.packageName}
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
        ))
      )}
    </Screen>
  );
}
