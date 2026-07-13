import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { formatMinutes } from '@/lib/format';
import { usePermissions } from '@/lib/permissions';
import { useDashboard } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import {
  AppAvatar,
  BarChart,
  Body,
  Card,
  GradientHeader,
  Heading,
  Label,
  Screen,
  Spinner,
  StatTile,
  Title,
} from '@/ui/kit';

export default function TodayScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { apps } = useStore();
  const { data, refresh } = useDashboard(apps);
  const { perm, refresh: refreshPerm } = usePermissions();

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshPerm();
    }, [refresh, refreshPerm]),
  );

  const appCount = Object.keys(apps).length;

  return (
    <Screen>
      <Title style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>Today</Title>

        {!perm.serviceRunning ? (
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
        ) : null}

        {!data ? (
          <Spinner />
        ) : (
          <>
            <GradientHeader>
              <Label style={{ color: '#BFE3E2' }}>Time on watched apps</Label>
              <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '800', marginTop: 6 }}>
                {data.usageAccess ? formatMinutes(data.totalMinutes) : '—'}
              </Text>
              <Body style={{ color: '#DDF1F0', marginTop: 4 }}>
                {data.totalBackedOut > 0
                  ? `You closed the pause and walked away ${data.totalBackedOut} ${
                      data.totalBackedOut === 1 ? 'time' : 'times'
                    } today.`
                  : appCount === 0
                    ? 'Add a few apps to start seeing your day here.'
                    : 'Every pause is a small win. Keep going.'}
              </Body>
            </GradientHeader>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <StatTile value={String(data.totalAttempts)} label="times you reached for them" icon="hand-left" tone="primary" />
              <StatTile value={String(data.totalBackedOut)} label="times you backed out" icon="checkmark-circle" />
            </View>

            {!data.usageAccess ? (
              <Card onPress={() => router.push('/onboarding')} style={{ marginTop: spacing.md }}>
                <Body dim>Turn on Usage Access to see time spent per app.</Body>
              </Card>
            ) : null}

            {data.weekly.length > 0 ? (
              <Card style={{ marginTop: spacing.md }}>
                <Heading style={{ fontSize: 16, marginBottom: spacing.md }}>Last 7 days</Heading>
                <BarChart values={data.weekly.map((d) => d.minutes)} labels={data.weekly.map((d) => d.label)} />
              </Card>
            ) : null}

            {data.perApp.length > 0 ? (
              <>
                <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Per app today</Label>
                {data.perApp.map((s) => (
                  <Card
                    key={s.packageName}
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
                ))}
              </>
            ) : appCount > 0 && data.usageAccess ? (
              <Card style={{ marginTop: spacing.md }}>
                <Body dim>No time on your watched apps yet today. Nice.</Body>
              </Card>
            ) : null}
          </>
        )}
    </Screen>
  );
}
