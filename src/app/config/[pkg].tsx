import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { InteractionManager, View } from 'react-native';

import { DAY_LETTERS, formatMinutes, startOfDayNDaysAgo } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { Native } from '@/lib/native';
import { usageForDay } from '@/lib/stats';
import { actions, useStoreSelector } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import {
  Appear,
  AppAvatar,
  BarChart,
  Body,
  Button,
  Card,
  Chips,
  Heading,
  Label,
  PressableScale,
  Screen,
  ToggleRow,
} from '@/ui/kit';

const BREATH_OPTIONS = [15, 20, 30, 45, 60];

type Week = { labels: string[]; values: number[]; total: number };

export default function AppConfigScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { pkg } = useLocalSearchParams<{ pkg: string }>();
  const apps = useStoreSelector((s) => s.apps);
  const live = pkg ? apps[pkg] : undefined;
  // Removal + router.back() land in the same frame; keep the last snapshot so the screen
  // doesn't flash its not-found fallback during the back transition.
  const lastSeen = useRef(live);
  if (live) lastSeen.current = live;
  const app = live ?? lastSeen.current;
  const [week, setWeek] = useState<Week | null>(null);

  // This app's last 7 days — after the slide-in settles, mostly from the shared day cache.
  useEffect(() => {
    if (!pkg) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      if (!Native.hasUsageAccess()) {
        setWeek({ labels: [], values: [], total: 0 });
        return;
      }
      const labels: string[] = [];
      const values: number[] = [];
      let totalMs = 0;
      for (let d = 6; d >= 0; d--) {
        const start = startOfDayNDaysAgo(d);
        const ms = usageForDay(d)[pkg] ?? 0;
        labels.push(DAY_LETTERS[new Date(start).getDay()]);
        values.push(Math.round(ms / 60000));
        totalMs += ms;
      }
      if (!cancelled) setWeek({ labels, values, total: Math.round(totalMs / 60000) });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [pkg]);

  if (!app) {
    return (
      <Screen>
        <Body dim style={{ marginTop: spacing.xxl }}>
          This app isn’t being watched.
        </Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
        <PressableScale
          scaleTo={0.9}
          hitSlop={12}
          accessibilityLabel="Back"
          onPress={() => {
            tap();
            router.back();
          }}
          style={{ marginRight: spacing.md }}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </PressableScale>
        <AppAvatar icon={app.icon} size={38} />
        <Heading style={{ fontSize: 22, marginLeft: spacing.md, flex: 1 }} numberOfLines={1}>
          {app.label}
        </Heading>
      </View>

      {week && week.values.length > 0 ? (
        <Appear index={0}>
          <Card style={{ marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Heading style={{ fontSize: 16, flex: 1 }}>This week here</Heading>
              <Heading style={{ fontSize: 16 }}>{formatMinutes(week.total)}</Heading>
            </View>
            <BarChart
              values={week.values}
              labels={week.labels}
              height={96}
              activeIndex={6}
              formatValue={(v) => formatMinutes(v)}
            />
          </Card>
        </Appear>
      ) : null}

      <Label style={{ marginBottom: spacing.sm }}>The pause</Label>
      <ToggleRow
        title="Show a breathing pause"
        subtitle="A short breathe screen before this app opens — you can always continue"
        value={app.enabled}
        onValueChange={(v) => actions.updateApp(app.packageName, { enabled: v })}
      />

      {app.enabled ? (
        <>
          <Card style={{ marginTop: spacing.sm }}>
            <Heading style={{ fontSize: 15, marginBottom: spacing.md }}>Make me wait</Heading>
            <Body dim style={{ marginBottom: spacing.md, fontSize: 13 }}>
              The real wait varies a little each time, so it can’t be counted down — and repeat
              opens wait a little longer.
            </Body>
            <Chips
              options={BREATH_OPTIONS}
              value={app.breathSeconds}
              onChange={(v) => actions.updateApp(app.packageName, { breathSeconds: v })}
              format={(v) => `${v}s`}
            />
          </Card>
          <View style={{ height: spacing.sm }} />
          <ToggleRow
            title="Ask “why are you opening it?”"
            subtitle="A gentle reflection prompt on the pause screen"
            value={app.reflection}
            onValueChange={(v) => actions.updateApp(app.packageName, { reflection: v })}
          />
        </>
      ) : null}

      <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Notifications</Label>
      <ToggleRow
        title="Mute this app’s notifications"
        subtitle="Dismiss its notifications while it’s being watched"
        value={app.muteNotifications}
        onValueChange={(v) => actions.updateApp(app.packageName, { muteNotifications: v })}
      />

      <Button
        title="Stop watching this app"
        variant="danger"
        icon="trash"
        onPress={() => {
          actions.removeApp(app.packageName);
          router.back();
        }}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
