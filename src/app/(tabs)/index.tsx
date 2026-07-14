import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';
import { Text, ToastAndroid, View } from 'react-native';

import { formatMinutes } from '@/lib/format';
import { usePermissions } from '@/lib/permissions';
import { useDashboard } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import {
  Appear,
  AppAvatar,
  BarChart,
  Body,
  Card,
  GradientHeader,
  Heading,
  Label,
  Screen,
  StatTile,
  Title,
} from '@/ui/kit';

function headline(totalMinutes: number, backedOut: number, appCount: number, usageAccess: boolean): string {
  if (appCount === 0) return 'Add a few apps to start seeing your day here.';
  if (!usageAccess) return 'Turn on Usage Access to see the real numbers.';
  if (totalMinutes >= 180)
    return `That's ${formatMinutes(totalMinutes)} of your day gone to these apps. Was it worth it?`;
  if (totalMinutes >= 60) return `${formatMinutes(totalMinutes)} you're not getting back. It adds up fast.`;
  if (backedOut > 0)
    return `You walked away ${backedOut} ${backedOut === 1 ? 'time' : 'times'} today. That's the habit breaking.`;
  if (totalMinutes > 0) return 'A light day so far. Keep it that way.';
  return 'Nothing yet today. Keep it that way.';
}

export default function TodayScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { apps } = useStore();
  const { data, refresh } = useDashboard(apps);
  const { perm, refresh: refreshPerm } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshPerm();
    }, [refresh, refreshPerm]),
  );

  // Pull down = refresh the numbers AND pull any over-the-air app update.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    refreshPerm();
    try {
      if (Updates.isEnabled) {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          ToastAndroid.show('Updating Pause…', ToastAndroid.SHORT);
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
          return; // reloads into the new version
        }
      }
    } catch {
      // offline or server unreachable — the stats refresh above still happened
    }
    setRefreshing(false);
  }, [refresh, refreshPerm]);

  const appCount = Object.keys(apps).length;
  const today = new Date();

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Appear index={0}>
        <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <Title>Today</Title>
          <Body faint style={{ marginTop: 2 }}>
            {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Body>
        </View>
      </Appear>

      {!perm.serviceRunning ? (
        <Appear index={0}>
          <Card tone="accent" onPress={() => router.push('/onboarding')} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="warning" size={22} color={c.accent} style={{ marginRight: spacing.md }} />
              <View style={{ flex: 1 }}>
                <Heading style={{ fontSize: 16 }}>Pause isn’t active</Heading>
                <Body dim style={{ fontSize: 13 }}>
                  The accessibility service is off, so nothing is being paused. Tap to finish setup.
                </Body>
              </View>
            </View>
          </Card>
        </Appear>
      ) : null}

      {data ? (
        <>
          <Appear index={1}>
            <GradientHeader onPress={() => router.push('/stats')}>
              <Label style={{ color: '#BFE3E2' }}>Time on watched apps</Label>
              <Text style={{ color: '#FFFFFF', fontSize: 44, fontWeight: '800', marginTop: 6, letterSpacing: -1 }}>
                {data.usageAccess ? formatMinutes(data.totalMinutes) : '—'}
              </Text>
              <Body style={{ color: '#DDF1F0', marginTop: 4 }}>
                {headline(data.totalMinutes, data.totalBackedOut, appCount, data.usageAccess)}
              </Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <Body style={{ color: '#BFE3E2', fontSize: 13, fontWeight: '700' }}>See your week</Body>
                <Ionicons name="arrow-forward" size={14} color="#BFE3E2" style={{ marginLeft: 4 }} />
              </View>
            </GradientHeader>
          </Appear>

          <Appear index={2}>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <StatTile
                value={String(data.totalAttempts)}
                label="times you reached for them"
                icon="hand-left"
                tone="primary"
                onPress={() => router.push('/attempts')}
              />
              <StatTile
                value={String(data.totalBackedOut)}
                label="times you backed out"
                icon="walk"
                onPress={() => router.push('/wins')}
              />
            </View>
          </Appear>

          {!data.usageAccess ? (
            <Appear index={3}>
              <Card onPress={() => router.push('/onboarding')} style={{ marginTop: spacing.md }}>
                <Body dim>Turn on Usage Access to see time spent per app.</Body>
              </Card>
            </Appear>
          ) : null}

          {data.weekly.length > 0 ? (
            <Appear index={3}>
              <Card onPress={() => router.push('/stats')} style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <Heading style={{ fontSize: 16, flex: 1 }}>Last 7 days</Heading>
                  <Body faint style={{ fontSize: 12.5, marginRight: 4 }}>Full stats</Body>
                  <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                </View>
                <BarChart
                  values={data.weekly.map((d) => d.minutes)}
                  labels={data.weekly.map((d) => d.label)}
                  activeIndex={6}
                  formatValue={(v) => formatMinutes(v)}
                />
              </Card>
            </Appear>
          ) : null}

          {data.perApp.length > 0 ? (
            <>
              <Appear index={4}>
                <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Per app today</Label>
              </Appear>
              {data.perApp.map((s, i) => (
                <Appear key={s.packageName} index={5 + i}>
                  <Card
                    onPress={() => router.push(`/config/${s.packageName}`)}
                    style={{ marginBottom: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <AppAvatar icon={apps[s.packageName]?.icon ?? null} />
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Heading style={{ fontSize: 16 }}>{s.label}</Heading>
                        <Body faint style={{ fontSize: 12.5 }}>
                          {s.opens} opens · {s.attempts} paused · {s.backedOut} backed out
                        </Body>
                      </View>
                      <Heading style={{ fontSize: 16 }}>{formatMinutes(s.minutes)}</Heading>
                    </View>
                  </Card>
                </Appear>
              ))}
            </>
          ) : appCount > 0 && data.usageAccess ? (
            <Appear index={4}>
              <Card style={{ marginTop: spacing.md }}>
                <Body dim>No time on your watched apps yet today. Nice.</Body>
              </Card>
            </Appear>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
