import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { computeEventHistory, type EventHistory } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import { Appear, AppAvatar, BarChart, Body, Card, Heading, Label, Screen, Spinner, StatTile } from '@/ui/kit';

/** Every time she reached the pause and chose to walk away — the habit actually breaking. */
export default function WinsScreen() {
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
  const winRate =
    data && data.totals.shown > 0 ? Math.round((data.totals.backedOut / data.totals.shown) * 100) : 0;
  const sorted = data ? [...data.perApp].sort((x, y) => y.backedOut - x.backedOut) : [];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Appear index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xs }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.md }}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Heading style={{ fontSize: 22 }}>Walking away</Heading>
        </View>
        <Body dim style={{ marginBottom: spacing.lg, marginLeft: 38 }}>
          Times you hit the pause and closed the app instead. These are the wins.
        </Body>
      </Appear>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <Appear index={1}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile
                value={String(data.streak)}
                label={data.streak === 1 ? 'day streak' : 'day streak of walking away'}
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
                labels={last14.map((d, i) => (i % 2 === 0 ? d.label.split(' ')[1] ?? d.label : ''))}
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
                    <Heading style={{ fontSize: 16 }}>{a.label}</Heading>
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
