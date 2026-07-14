import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Text, TextInput, ToastAndroid, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CHANGELOG, CURRENT_CHANGELOG_ID } from '@/lib/changelog';
import { formatMinutes } from '@/lib/format';
import { usePermissions } from '@/lib/permissions';
import { useDashboard } from '@/lib/stats';
import { actions, useHydrated, useStoreSelector } from '@/lib/store';
import { radius, spacing, useAppTheme } from '@/theme';
import {
  Appear,
  AppAvatar,
  BarChart,
  Body,
  Button,
  Card,
  GradientHeader,
  Heading,
  Label,
  Screen,
  StatTile,
  Title,
} from '@/ui/kit';

function headline(
  totalMinutes: number,
  backedOut: number,
  appCount: number,
  usageAccess: boolean,
  weekly: { minutes: number }[],
): string {
  if (appCount === 0) return 'Add a few apps to start seeing your day here.';
  if (!usageAccess) return 'Turn on Usage Access to see the real numbers.';
  // Her own week is the honest yardstick — fixed thresholds turn preachy over time.
  const prior = weekly.slice(0, 6);
  const avg = prior.length > 0 ? prior.reduce((s, d) => s + d.minutes, 0) / prior.length : 0;
  if (avg > 0 && totalMinutes >= 60 && totalMinutes < 0.75 * avg)
    return `${formatMinutes(totalMinutes)} so far — under your usual pace.`;
  if (avg > 0 && totalMinutes >= 60 && totalMinutes > 1.25 * avg)
    return `${formatMinutes(totalMinutes)} — already past a normal day, and it isn't over.`;
  if (totalMinutes >= 180)
    return `That's ${formatMinutes(totalMinutes)} of your day gone to these apps. Was it worth it?`;
  if (totalMinutes >= 60) return `${formatMinutes(totalMinutes)} you're not getting back. It adds up fast.`;
  if (backedOut > 0)
    return `You walked away ${backedOut} ${backedOut === 1 ? 'time' : 'times'} today. That's the habit breaking.`;
  if (totalMinutes > 0) return 'A light day so far. Keep it that way.';
  return "Nothing yet today. That's how a good day starts.";
}

// Cast: reanimated drives the native `text` prop directly (the standard ReText trick),
// which TextInputProps doesn't know about.
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput) as unknown as React.ComponentType<
  React.ComponentProps<typeof TextInput> & { animatedProps?: unknown }
>;

/** The 44pt hero total counts up so the day's cost registers as an amount, not a label. */
function HeroMinutes({ minutes }: { minutes: number }) {
  const v = useSharedValue(minutes);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current === minutes) return; // focus refreshes with the same value must not replay
    const first = last.current === null;
    last.current = minutes;
    if (minutes === 0) {
      v.value = 0; // snap — animating to nothing celebrates nothing
      return;
    }
    if (first) v.value = 0;
    v.value = withTiming(minutes, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [minutes, v]);
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const m = Math.max(0, Math.round(v.value));
    const h = Math.floor(m / 60);
    const rem = m % 60;
    const text = m < 60 ? `${m}m` : rem === 0 ? `${h}h` : `${h}h ${rem}m`;
    return { text } as { text: string };
  });
  return (
    <AnimatedTextInput
      editable={false}
      defaultValue={formatMinutes(minutes)}
      animatedProps={animatedProps}
      style={{
        color: '#FFFFFF',
        fontSize: 44,
        fontWeight: '800',
        letterSpacing: -1,
        marginTop: 6,
        padding: 0,
      }}
    />
  );
}

function WhatsNewCard({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useAppTheme();
  const entry = CHANGELOG[0];
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ backgroundColor: c.bgElevated, borderRadius: radius.lg, padding: spacing.xl }}>
          <Label style={{ color: c.primary }}>What’s new · v{entry.version}</Label>
          <Heading style={{ fontSize: 22, marginTop: 4, marginBottom: spacing.md }}>{entry.title}</Heading>
          {entry.highlights.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
              <Ionicons name="sparkles" size={14} color={c.primary} style={{ marginTop: 3, marginRight: spacing.sm }} />
              <Body dim style={{ flex: 1, fontSize: 14 }}>{h}</Body>
            </View>
          ))}
          <Button title="Nice" onPress={onClose} style={{ marginTop: spacing.lg }} />
        </View>
      </View>
    </Modal>
  );
}

export default function TodayScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const hydrated = useHydrated();
  const apps = useStoreSelector((s) => s.apps);
  const settings = useStoreSelector((s) => s.settings);
  const { data, refresh } = useDashboard(apps);
  const { perm, refresh: refreshPerm } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const [showNews, setShowNews] = useState(false);

  // One-time "what's new" card after an update lands.
  useEffect(() => {
    if (hydrated && settings.onboardingComplete && settings.lastSeenChangelog !== CURRENT_CHANGELOG_ID) {
      setShowNews(true);
    }
  }, [hydrated, settings.onboardingComplete, settings.lastSeenChangelog]);

  const closeNews = useCallback(() => {
    setShowNews(false);
    actions.updateSettings({ lastSeenChangelog: CURRENT_CHANGELOG_ID });
  }, []);

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
      <WhatsNewCard visible={showNews} onClose={closeNews} />
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
            <GradientHeader onPress={() => router.push(data.usageAccess ? '/stats' : '/onboarding')}>
              <Label style={{ color: c.onOverlayFaint }}>Time on watched apps</Label>
              {data.usageAccess ? (
                <HeroMinutes minutes={data.totalMinutes} />
              ) : (
                <Text style={{ color: c.onOverlay, fontSize: 44, fontWeight: '800', marginTop: 6, letterSpacing: -1 }}>
                  —
                </Text>
              )}
              <Body style={{ color: c.onOverlayDim, marginTop: 4 }}>
                {headline(data.totalMinutes, data.totalBackedOut, appCount, data.usageAccess, data.weekly)}
              </Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
                <Body style={{ color: c.onOverlayFaint, fontSize: 13, fontWeight: '700' }}>
                  {data.usageAccess ? 'See your week' : 'Turn it on'}
                </Body>
                <Ionicons name="arrow-forward" size={14} color={c.onOverlayFaint} style={{ marginLeft: 4 }} />
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
                        <Heading style={{ fontSize: 16 }} numberOfLines={1}>
                          {s.label}
                        </Heading>
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
