import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { computeEventHistory, type EventHistory } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import { Appear, AppAvatar, BarChart, Body, Card, Heading, Label, Screen, Spinner, StatTile } from '@/ui/kit';

/** Every time the pause screen stood between her and the app — the raw pull of the habit. */
export default function AttemptsScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { apps } = useStore();
  const [data, setData] = useState<EventHistory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const compute = useCallback(() => setData(computeEventHistory(apps)), [apps]);

  useEffect(() => {
    const t = setTimeout(compute, 40);
    return () => clearTimeout(t);
  }, [compute]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      compute();
      setRefreshing(false);
    }, 60);
  }, [compute]);

  const last14 = data?.days.slice(-14) ?? [];
  const today = data?.days[data.days.length - 1];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Appear index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xs }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.md }}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Heading style={{ fontSize: 22 }}>Reaching for them</Heading>
        </View>
        <Body dim style={{ marginBottom: spacing.lg, marginLeft: 38 }}>
          Every time the pause screen appeared — the pull of the habit itself.
        </Body>
      </Appear>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <Appear index={1}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile value={String(today?.shown ?? 0)} label="times today" icon="hand-left" tone="primary" />
              <StatTile value={String(data.totals.shown)} label="in the last 30 days" icon="calendar" />
            </View>
          </Appear>

          <Appear index={2}>
            <Card style={{ marginTop: spacing.md }}>
              <Heading style={{ fontSize: 16, marginBottom: spacing.md }}>Last 14 days</Heading>
              <BarChart
                values={last14.map((d) => d.shown)}
                labels={last14.map((d, i) => (i % 2 === 0 ? d.label.split(' ')[1] ?? d.label : ''))}
                activeIndex={last14.length - 1}
                formatValue={(v) => String(v)}
              />
            </Card>
          </Appear>

          <Appear index={3}>
            <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Per app · 30 days</Label>
          </Appear>
          {data.perApp.map((a, i) => (
            <Appear key={a.packageName} index={4 + i}>
              <Card onPress={() => router.push(`/config/${a.packageName}`)} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AppAvatar icon={a.icon} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Heading style={{ fontSize: 16 }}>{a.label}</Heading>
                    <Body faint style={{ fontSize: 12.5 }}>
                      {a.continued} went in · {a.backedOut} walked away
                    </Body>
                  </View>
                  <Heading style={{ fontSize: 16 }}>{a.shown}×</Heading>
                </View>
              </Card>
            </Appear>
          ))}
        </>
      )}
    </Screen>
  );
}
