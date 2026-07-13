import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Native } from '@/lib/native';
import { actions, useStore } from '@/lib/store';
import type { InstalledApp } from '@/lib/types';
import { radius, spacing, useAppTheme } from '@/theme';
import { AppAvatar, Body, Card, Heading, Screen, Spinner } from '@/ui/kit';

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
  const { apps } = useStore();
  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Native.getInstalledApps().then(setInstalled);
  }, []);

  const filtered = useMemo(() => {
    if (!installed) return [];
    const q = query.trim().toLowerCase();
    const matched = q ? installed.filter((a) => a.label.toLowerCase().includes(q)) : installed;
    return [...matched].sort((a, b) => {
      const pa = POPULAR.has(a.packageName) ? 0 : 1;
      const pb = POPULAR.has(b.packageName) ? 0 : 1;
      return pa - pb || a.label.localeCompare(b.label);
    });
  }, [installed, query]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.sm }}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
        <Heading style={{ fontSize: 22 }}>Add an app</Heading>
      </View>

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
          style={{ flex: 1, color: c.text, paddingVertical: 12, marginLeft: spacing.sm, fontSize: 16 }}
        />
      </View>

      {!installed ? (
        <Spinner />
      ) : (
        filtered.map((app) => {
          const added = !!apps[app.packageName];
          return (
            <Card
              key={app.packageName}
              onPress={
                added
                  ? undefined
                  : () => {
                      actions.addApp(app.packageName, app.label, app.icon);
                      router.back();
                    }
              }
              style={{ marginBottom: spacing.sm, opacity: added ? 0.55 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppAvatar icon={app.icon} />
                <Heading style={{ fontSize: 16, flex: 1, marginLeft: spacing.md }}>{app.label}</Heading>
                {added ? (
                  <Body style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>Added</Body>
                ) : (
                  <Ionicons name="add-circle" size={24} color={c.primary} />
                )}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
