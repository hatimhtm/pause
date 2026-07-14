import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { light, tap } from '@/lib/haptics';
import { Native } from '@/lib/native';
import { actions, useStoreSelector } from '@/lib/store';
import type { InstalledApp } from '@/lib/types';
import { spacing, useAppTheme } from '@/theme';
import { AppAvatar, Body, Button, Card, Heading, Input, PressableScale, Screen, Spinner } from '@/ui/kit';

// Popular time-sink apps to float to the top when present.
const POPULAR = new Set([
  'com.instagram.android',
  'com.zhiliaoapp.musically',
  'com.ss.android.ugc.trill',
  'com.google.android.youtube',
  'com.facebook.katana',
  'com.snapchat.android',
  'com.twitter.android',
  'com.x.android',
  'com.reddit.frontpage',
  'com.tiktok',
]);

// The installed-apps query is icon-heavy; cache it for the session so reopening is instant.
let installedCache: InstalledApp[] | null = null;

const ROW_HEIGHT = 44 + spacing.lg * 2 + 1; // avatar + card padding + hairline
const ROW_STRIDE = ROW_HEIGHT + spacing.sm;

const Row = React.memo(function Row({
  app,
  added,
  onToggle,
}: {
  app: InstalledApp;
  added: boolean;
  onToggle: (app: InstalledApp) => void;
}) {
  const c = useAppTheme();
  return (
    <Card
      haptic={false}
      onPress={() => onToggle(app)}
      tone={added ? 'primarySoft' : 'card'}
      style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppAvatar icon={app.icon} />
        <Heading style={{ fontSize: 16, flex: 1, marginLeft: spacing.md }} numberOfLines={1}>
          {app.label}
        </Heading>
        <Ionicons
          name={added ? 'checkmark-circle' : 'add-circle-outline'}
          size={24}
          color={added ? c.primary : c.textFaint}
        />
      </View>
    </Card>
  );
});

export default function PickerScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const apps = useStoreSelector((s) => s.apps);
  const [installed, setInstalled] = useState<InstalledApp[] | null>(installedCache);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Native.getInstalledApps().then((list) => {
      installedCache = list;
      setInstalled(list);
    });
  }, []);

  // Sort once per fetched list; the query only filters the pre-sorted array.
  const sorted = useMemo(() => {
    if (!installed) return [];
    return [...installed].sort((a, b) => {
      const pa = POPULAR.has(a.packageName) ? 0 : 1;
      const pb = POPULAR.has(b.packageName) ? 0 : 1;
      return pa - pb || a.label.localeCompare(b.label);
    });
  }, [installed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (a) => a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  const count = Object.keys(apps).length;

  // The Done button acknowledges each change with a small pulse.
  const donePulse = useSharedValue(1);
  const doneStyle = useAnimatedStyle(() => ({ transform: [{ scale: donePulse.value }] }));

  // Tap = toggle watching. Adding is the weightier act — it gets the weightier haptic.
  const toggle = useCallback(
    (app: InstalledApp) => {
      if (apps[app.packageName]) {
        tap();
        actions.removeApp(app.packageName);
      } else {
        light();
        actions.addApp(app.packageName, app.label, app.icon);
      }
      donePulse.value = withSequence(
        withTiming(1.04, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      );
    },
    [apps, donePulse],
  );

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md }}>
        <PressableScale
          scaleTo={0.9}
          hitSlop={12}
          accessibilityLabel="Close"
          onPress={() => {
            tap();
            router.back();
          }}
          style={{ marginRight: spacing.sm }}>
          <Ionicons name="close" size={26} color={c.text} />
        </PressableScale>
        <Heading style={{ fontSize: 22, flex: 1 }}>Add apps</Heading>
        <Body dim style={{ fontSize: 13 }}>
          {count} watched
        </Body>
      </View>

      {/* Search stays pinned above the list — it never scrolls away. */}
      <View style={{ marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input
            icon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            autoCorrect={false}
          />
        </View>
        {query.length > 0 ? (
          <PressableScale
            scaleTo={0.85}
            hitSlop={10}
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')} // silent: a haptic mid-typing would interrupt
            style={{ position: 'absolute', right: spacing.md }}>
            <Ionicons name="close-circle" size={18} color={c.textFaint} />
          </PressableScale>
        ) : null}
      </View>

      {!installed ? (
        <Spinner />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(app) => app.packageName}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={7}
          getItemLayout={(_, index) => ({ length: ROW_STRIDE, offset: ROW_STRIDE * index, index })}
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          ListEmptyComponent={
            <Card>
              <Body dim>
                {query.trim().length > 0
                  ? `No app matches “${query.trim()}”.`
                  : 'No apps found on this phone.'}
              </Body>
            </Card>
          }
          renderItem={({ item: app }) => (
            <Row app={app} added={!!apps[app.packageName]} onToggle={toggle} />
          )}
        />
      )}

      {/* Floating Done — always reachable, shows what you've picked. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: insets.bottom + 16 },
          doneStyle,
        ]}>
        <Button
          title={count > 0 ? `Done — watching ${count}` : 'Done'}
          icon="checkmark"
          onPress={() => router.back()}
        />
      </Animated.View>
    </Screen>
  );
}
