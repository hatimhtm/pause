import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { formatMinutes, startOfDayNDaysAgo } from '@/lib/format';
import { Native } from '@/lib/native';
import { computeAndCacheHistory, getCachedHistory, type EventHistory } from '@/lib/stats';
import { useStoreSelector } from '@/lib/store';
import { spacing } from '@/theme';
import { Appear, AppAvatar, BarChart, Body, Card, Heading, Label, PageHeader, Screen, Spinner, StatTile } from '@/ui/kit';

/**
 * Walk-aways × the typical session length in each app ≈ the time those wins bought back.
 * Honest by construction: derived per app, clamped to sane session lengths, hidden when
 * the inputs don't exist.
 */
function estimateReclaimedMinutes(data: EventHistory): number {
  if (!Native.hasUsageAccess()) return 0;
  const start = startOfDayNDaysAgo(29);
  const now = Date.now();
  const usage = Native.getUsage(start, now);
  const opens = Native.getOpens(start, now);
  let total = 0;
  for (const a of data.perApp) {
    if (a.backedOut === 0) continue;
    const o = opens[a.packageName] ?? 0;
    if (o === 0) continue;
    const avgSessionMin = Math.min(30, Math.max(1, (usage[a.packageName] ?? 0) / 60000 / o));
    total += avgSessionMin * a.backedOut;
  }
  return Math.round(total);
}

/** Every time she reached the pause and chose to walk away — the habit actually breaking. */
export default function WinsScreen() {
  const router = useRouter();
  const apps = useStoreSelector((s) => s.apps);
  const [data, setData] = useState<EventHistory | null>(() => getCachedHistory(apps));
  const [reclaimed, setReclaimed] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const compute = useCallback(() => {
    const d = computeAndCacheHistory(apps);
    setData(d);
    setReclaimed(estimateReclaimedMinutes(d));
  }, [apps]);

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
  const winRate =
    data && data.totals.shown > 0 ? Math.round((data.totals.backedOut / data.totals.shown) * 100) : 0;
  const sorted = data ? [...data.perApp].sort((x, y) => y.backedOut - x.backedOut) : [];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Appear index={0}>
        <PageHeader
          title="Walking away"
          subtitle="Times you hit the pause and closed the app instead. These are the wins."
          onBack={() => router.back()}
        />
      </Appear>

      {!data ? (
        <Spinner />
      ) : (
        <>
          {reclaimed > 0 ? (
            <Appear index={1}>
              <Card tone="primarySoft" style={{ marginBottom: spacing.md }}>
                <Heading style={{ fontSize: 20 }}>
                  Roughly {formatMinutes(reclaimed)} not spent in these apps
                </Heading>
                <Body faint style={{ fontSize: 12.5, marginTop: 4 }}>
                  Last 30 days · walk-aways × your typical session there
                </Body>
              </Card>
            </Appear>
          ) : null}

          <Appear index={1}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile
                value={data.streakCapped ? `${data.streak}+` : String(data.streak)}
                label="day streak of walking away"
                icon="flame"
                tone="primary"
              />
              <StatTile value={String(data.totals.backedOut)} label="wins in 30 days" icon="trophy" />
            </View>
          </Appear>

          <Appear index={2}>
            <Card style={{ marginTop: spacing.md }}>
              <Body dim style={{ fontSize: 13.5 }}>
                {data.totals.shown > 0
                  ? `You walk away from ${winRate}% of the opens Pause catches. Every point higher is the habit losing its grip.`
                  : 'No pauses recorded yet — this fills in as Pause starts catching opens.'}
              </Body>
            </Card>
          </Appear>

          <Appear index={3}>
            <Card style={{ marginTop: spacing.md }}>
              <Heading style={{ fontSize: 16, marginBottom: spacing.md }}>Last 14 days</Heading>
              <BarChart
                values={last14.map((d) => d.backedOut)}
                labels={last14.map((d, i) => (i % 2 === 0 ? String(d.dayOfMonth) : ''))}
                activeIndex={last14.length - 1}
                formatValue={(v) => String(v)}
              />
            </Card>
          </Appear>

          <Appear index={4}>
            <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Per app · 30 days</Label>
          </Appear>
          {sorted.map((a, i) => (
            <Appear key={a.packageName} index={5 + i}>
              <Card onPress={() => router.push(`/config/${a.packageName}`)} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AppAvatar icon={a.icon} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Heading style={{ fontSize: 16 }} numberOfLines={1}>
                      {a.label}
                    </Heading>
                    <Body faint style={{ fontSize: 12.5 }}>
                      walked away {a.backedOut} of {a.shown} times
                    </Body>
                  </View>
                  <Heading style={{ fontSize: 16 }}>
                    {a.shown > 0 ? `${Math.round((a.backedOut / a.shown) * 100)}%` : '—'}
                  </Heading>
                </View>
              </Card>
            </Appear>
          ))}
        </>
      )}
    </Screen>
  );
}
