import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { CHANGELOG } from '@/lib/changelog';
import { tap } from '@/lib/haptics';
import { actions, useStore } from '@/lib/store';
import { radius, spacing, useAppTheme } from '@/theme';
import { Appear, Body, Card, Chips, Heading, Label, PressableScale, Screen, Title, ToggleRow } from '@/ui/kit';

const BREATH_PRESETS = [
  { name: 'Calm teal', colorTop: '#06403F', colorBottom: '#0E7C7B', colorAccent: '#BFE3E2' },
  { name: 'Burgundy', colorTop: '#2E060D', colorBottom: '#7A1E2C', colorAccent: '#F3CDD3' },
  { name: 'Dusk', colorTop: '#2A2140', colorBottom: '#5B4B8A', colorAccent: '#D9CFF2' },
  { name: 'Midnight', colorTop: '#0B1026', colorBottom: '#2C3E6B', colorAccent: '#CBD8F5' },
  { name: 'Clay', colorTop: '#4A241C', colorBottom: '#B4573D', colorAccent: '#F3D2C4' },
  { name: 'Forest', colorTop: '#122A1E', colorBottom: '#2E6B45', colorAccent: '#CDEBD6' },
];

export default function SettingsScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { settings, breath } = useStore();
  const [checking, setChecking] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // Two versions exist on purpose: the UI ships over the air (this bundle), the engine only
  // ships in an APK. CHANGELOG[0] states what this bundle is; the APK reports itself.
  const uiVersion = CHANGELOG[0].version;
  const engineVersion = (Updates.runtimeVersion || Constants.expoConfig?.version) ?? '?';
  const engineOutdated = engineVersion !== '?' && engineVersion !== uiVersion;
  const otaTag = Updates.updateId
    ? `update ${Updates.updateId.slice(0, 8)}${
        Updates.createdAt ? ` · ${new Date(Updates.createdAt).toLocaleDateString()}` : ''
      }`
    : 'built-in bundle';

  const checkUpdates = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('Updates', 'Over-the-air updates are only active in a release build.');
      return;
    }
    setChecking(true);
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        Alert.alert('Up to date', 'You’re on the latest version.');
      }
    } catch {
      Alert.alert('Update check failed', 'Could not reach the update server.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <Title style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>Settings</Title>

      <Card style={{ marginBottom: spacing.sm }}>
        <Heading style={{ fontSize: 15, marginBottom: spacing.md }}>Default pause length</Heading>
        <Body dim style={{ marginBottom: spacing.md, fontSize: 13 }}>
          Used for newly added apps. 15 seconds is the floor, and the real wait varies a little
          each time — no counter, no counting along.
        </Body>
        <Chips
          options={[15, 20, 30, 45, 60]}
          value={settings.defaultBreathSeconds}
          onChange={(v) => actions.updateSettings({ defaultBreathSeconds: v })}
          format={(v) => `${v}s`}
        />
      </Card>

      <Card style={{ marginBottom: spacing.sm }}>
        <Heading style={{ fontSize: 15, marginBottom: spacing.md }}>Grace after continuing</Heading>
        <Body dim style={{ marginBottom: spacing.md, fontSize: 13 }}>
          Once you choose to go into an app, Pause won’t interrupt you again for this long.
        </Body>
        <Chips
          options={[1, 3, 5, 10, 15, 30]}
          value={settings.sessionMinutes}
          onChange={(v) => actions.updateSettings({ sessionMinutes: v })}
          format={(v) => `${v}m`}
        />
      </Card>

      <ToggleRow
        title="Haptics"
        subtitle="Gentle feedback on taps and toggles"
        value={settings.haptics}
        onValueChange={(v) => actions.updateSettings({ haptics: v })}
      />

      <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Breathe screen</Label>
      <Card style={{ marginBottom: spacing.sm }}>
        <Label style={{ marginBottom: spacing.sm }}>Title</Label>
        <TextInput
          value={breath.title}
          onChangeText={(t) => actions.updateBreath({ title: t })}
          placeholder="Take a breath"
          placeholderTextColor={c.textFaint}
          style={{ color: c.text, backgroundColor: c.bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16, marginBottom: spacing.md }}
        />
        <Label style={{ marginBottom: spacing.sm }}>Theme</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {BREATH_PRESETS.map((p) => {
            const active = breath.colorBottom === p.colorBottom && breath.colorTop === p.colorTop;
            return (
              <PressableScale
                key={p.name}
                scaleTo={0.9}
                onPress={() => {
                  tap();
                  actions.updateBreath({ colorTop: p.colorTop, colorBottom: p.colorBottom, colorAccent: p.colorAccent });
                }}
                style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: p.colorBottom,
                    borderWidth: active ? 3 : 0,
                    borderColor: c.text,
                  }}
                />
                <Body faint style={{ fontSize: 10, marginTop: 4 }}>{p.name}</Body>
              </PressableScale>
            );
          })}
        </View>
      </Card>

      <Card onPress={() => router.push('/onboarding')} style={{ marginBottom: spacing.sm }}>
        <Heading style={{ fontSize: 15 }}>Permissions & setup</Heading>
        <Body dim style={{ fontSize: 13, marginTop: 2 }}>
          Check or change the permissions Pause uses.
        </Body>
      </Card>

      <Card onPress={checking ? undefined : checkUpdates} style={{ marginBottom: spacing.sm }}>
        <Heading style={{ fontSize: 15 }}>{checking ? 'Checking…' : 'Check for updates'}</Heading>
        <Body dim style={{ fontSize: 13, marginTop: 2 }}>
          Pull the latest version over the air.
        </Body>
      </Card>

      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Heading style={{ fontSize: 15 }}>Version</Heading>
            <Body dim style={{ fontSize: 13, marginTop: 2 }}>
              UI v{uiVersion} · {otaTag}
            </Body>
            <Body dim style={{ fontSize: 13, marginTop: 2 }}>
              Engine v{engineVersion}
            </Body>
          </View>
        </View>
        {engineOutdated ? (
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync('https://github.com/hatimhtm/pause/releases/latest')}
            style={{ marginTop: spacing.sm }}>
            <Body style={{ color: c.accent, fontSize: 13 }}>
              The screens update themselves, but the pause engine ships in the APK — engine v
              {uiVersion} is on GitHub. Tap to get it.
            </Body>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setLogOpen((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
          <Body style={{ color: c.primary, fontSize: 14, fontWeight: '700', flex: 1 }}>
            What’s changed
          </Body>
          <Ionicons name={logOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.primary} />
        </Pressable>
        {logOpen
          ? CHANGELOG.map((entry, idx) => (
              <Appear key={entry.id} index={idx}>
                <View
                  style={{
                    marginTop: spacing.md,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: c.border,
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Heading style={{ fontSize: 14.5, flex: 1 }}>
                      v{entry.version} — {entry.title}
                    </Heading>
                    <Body faint style={{ fontSize: 11.5 }}>{entry.date}</Body>
                  </View>
                  {entry.highlights.map((h, i) => (
                    <Body key={i} dim style={{ fontSize: 13, marginTop: 4 }}>
                      ·  {h}
                    </Body>
                  ))}
                </View>
              </Appear>
            ))
          : null}
      </Card>

      <Card>
        <Heading style={{ fontSize: 15, marginBottom: spacing.xs }}>About Pause</Heading>
        <Body dim style={{ fontSize: 13 }}>
          A personal focus tool. Everything lives on this device — no accounts, no servers, nothing
          uploaded. It never fully blocks an app; it just makes the mindless open take a breath, and
          shows you honest numbers so you can decide for yourself.
        </Body>
      </Card>
    </Screen>
  );
}
