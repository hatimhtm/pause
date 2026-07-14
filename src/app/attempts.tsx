import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { computeAndCacheHistory, getCachedHistory, type EventHistory } from '@/lib/stats';
import { useStoreSelector } from '@/lib/store';
import { spacing } from '@/theme';
import { Appear, AppAvatar, BarChart, Body, Card, Heading, Label, PageHeader, Screen, Spinner, StatTile } from '@/ui/kit';

/** Every time the pause screen stood between her and the app — the raw pull of the habit. */
export default function AttemptsScreen() {
  const router = useRouter();
  const apps = useStoreSelector((s) => s.apps);
  const [data, setData] = useState<EventHistory | null>(() => getCachedHistory(apps));
  const [refreshing, setRefreshing] = useState(false);

  const compute = useCallback(() => setData(computeAndCacheHistory(apps)), [apps]);

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
        <PageHeader
          title="Reaching for them"
          subtitle="Every time the pause screen appeared — the pull of the habit itself."
          onBack={() => router.back()}
        />
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
                labels={last14.map((d, i) => (i % 2 === 0 ? String(d.dayOfMonth) : ''))}
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
                    <Heading style={{ fontSize: 16 }} numberOfLines={1}>
                      {a.label}
                    </Heading>
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
