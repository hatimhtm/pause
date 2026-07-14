import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { Native } from '@/lib/native';
import { actions, useStore } from '@/lib/store';
import type { InstalledApp } from '@/lib/types';
import { radius, spacing, useAppTheme } from '@/theme';
import { AppAvatar, Body, Button, Card, Heading, Screen, Spinner } from '@/ui/kit';

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

export default function PickerScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { apps } = useStore();
  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Native.getInstalledApps().then(setInstalled);
  }, []);

  const filtered = useMemo(() => {
    if (!installed) return [];
    const q = query.trim().toLowerCase();
    const matched = q
      ? installed.filter(
          (a) => a.label.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q),
        )
      : installed;
    return [...matched].sort((a, b) => {
      const pa = POPULAR.has(a.packageName) ? 0 : 1;
      const pb = POPULAR.has(b.packageName) ? 0 : 1;
      return pa - pb || a.label.localeCompare(b.label);
    });
  }, [installed, query]);

  const count = Object.keys(apps).length;

  // Tap = toggle watching. Nothing closes; add as many as you want, then Done.
  const toggle = (app: InstalledApp) => {
    tap();
    if (apps[app.packageName]) actions.removeApp(app.packageName);
    else actions.addApp(app.packageName, app.label, app.icon);
  };

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.sm }}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
        <Heading style={{ fontSize: 22, flex: 1 }}>Add apps</Heading>
        <Body dim style={{ fontSize: 13 }}>
          {count} watched
        </Body>
      </View>

      {/* Search stays pinned above the list — it never scrolls away. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: spacing.md,
          marginBottom: spacing.md,
        }}>
        <Ionicons name="search" size={18} color={c.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search apps"
          placeholderTextColor={c.textFaint}
          autoCorrect={false}
          style={{ flex: 1, color: c.text, paddingVertical: 12, marginLeft: spacing.sm, fontSize: 16 }}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={c.textFaint} />
          </Pressable>
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
          contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
          ListEmptyComponent={
            <Card>
              <Body dim>No app matches “{query}”.</Body>
            </Card>
          }
          renderItem={({ item: app }) => {
            const added = !!apps[app.packageName];
            return (
              <Card
                onPress={() => toggle(app)}
                tone={added ? 'primarySoft' : 'card'}
                style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AppAvatar icon={app.icon} />
                  <Heading style={{ fontSize: 16, flex: 1, marginLeft: spacing.md }}>{app.label}</Heading>
                  <Ionicons
                    name={added ? 'checkmark-circle' : 'add-circle-outline'}
                    size={24}
                    color={added ? c.primary : c.textFaint}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Floating Done — always reachable, shows what you've picked. */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: insets.bottom + 16 }}>
        <Button
          title={count > 0 ? `Done — watching ${count}` : 'Done'}
          icon="checkmark"
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}
