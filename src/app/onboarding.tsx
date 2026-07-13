import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Native } from '@/lib/native';
import { usePermissions } from '@/lib/permissions';
import { actions, useStore } from '@/lib/store';
import type { InstalledApp } from '@/lib/types';
import { palette, radius, spacing, useAppTheme } from '@/theme';
import { AppAvatar, Body, Button, Card, Heading, Title } from '@/ui/kit';

const POPULAR = [
  'com.instagram.android',
  'com.zhiliaoapp.musically',
  'com.google.android.youtube',
  'com.snapchat.android',
  'com.facebook.katana',
  'com.twitter.android',
  'com.x.android',
  'com.reddit.frontpage',
];

export default function Onboarding() {
  const c = useAppTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { perm, refresh } = usePermissions();

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const finish = () => {
    actions.completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: spacing.md }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? c.primary : c.border }}
          />
        ))}
      </View>

      {step === 0 ? <Welcome onNext={() => setStep(1)} /> : null}
      {step === 1 ? <Permissions perm={perm} onOpen={refresh} onNext={() => setStep(2)} /> : null}
      {step === 2 ? <PickApps onDone={finish} /> : null}
    </SafeAreaView>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const c = useAppTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
      <LinearGradient
        colors={[palette.tealDeep, palette.teal]}
        style={{ borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', paddingVertical: spacing.xxxl }}>
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
          <Ionicons name="pause" size={40} color="#fff" />
        </View>
        <Title style={{ color: '#fff' }}>Pause</Title>
        <Body style={{ color: '#DDF1F0', textAlign: 'center', marginTop: spacing.sm }}>
          A calmer relationship with the apps that pull you in.
        </Body>
      </LinearGradient>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Point icon="leaf" title="It never blocks you" body="Open anything you like — Pause just adds a short breath first, so the mindless opens fade away." />
        <Point icon="stats-chart" title="Honest numbers" body="See time spent, how often you reach for each app, and how often you chose to walk away." />
        <Point icon="lock-closed" title="Yours alone" body="Everything stays on this phone. No accounts, no servers, nothing uploaded." />
      </View>

      <View style={{ flex: 1 }} />
      <Button title="Get started" icon="arrow-forward" onPress={onNext} style={{ marginTop: spacing.xxl }} />
    </ScrollView>
  );
}

function Point({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const c = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
        <Ionicons name={icon} size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Heading style={{ fontSize: 16 }}>{title}</Heading>
        <Body dim style={{ fontSize: 13.5, marginTop: 2 }}>{body}</Body>
      </View>
    </View>
  );
}

function Permissions({
  perm,
  onOpen,
  onNext,
}: {
  perm: { accessibility: boolean; usage: boolean; notifications: boolean };
  onOpen: () => void;
  onNext: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
      <Title>A few permissions</Title>
      <Body dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        Grant these in Settings, then come back. Only the first is required.
      </Body>

      <PermCard
        granted={perm.accessibility}
        title="Accessibility service"
        why="How Pause notices which app opens so it can show the breathing screen. Required."
        onPress={() => { Native.openAccessibilitySettings(); onOpen(); }}
      />
      <PermCard
        granted={perm.usage}
        title="Usage access"
        why="Powers the honest stats — time spent and opens per app."
        onPress={() => { Native.openUsageAccessSettings(); onOpen(); }}
      />
      <PermCard
        granted={perm.notifications}
        title="Notification access"
        why="Optional. Lets Pause mute notifications from apps you mute or during quiet hours."
        onPress={() => { Native.openNotificationAccessSettings(); onOpen(); }}
      />

      <View style={{ flex: 1 }} />
      <Button
        title={perm.accessibility ? 'Continue' : 'Grant accessibility to continue'}
        icon="arrow-forward"
        disabled={!perm.accessibility}
        onPress={onNext}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

function PermCard({ granted, title, why, onPress }: { granted: boolean; title: string; why: string; onPress: () => void }) {
  const c = useAppTheme();
  return (
    <Card tone={granted ? 'primarySoft' : 'card'} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Ionicons name={granted ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={granted ? c.primary : c.textFaint} />
        <Heading style={{ fontSize: 16, marginLeft: spacing.sm }}>{title}</Heading>
      </View>
      <Body dim style={{ fontSize: 13 }}>{why}</Body>
      {!granted ? <Button title="Open settings" variant="ghost" onPress={onPress} style={{ marginTop: spacing.md }} /> : null}
    </Card>
  );
}

function PickApps({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { apps } = useStore();
  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);

  useEffect(() => {
    Native.getInstalledApps().then(setInstalled);
  }, []);

  const suggestions = (installed ?? []).filter((a) => POPULAR.includes(a.packageName));
  const count = Object.keys(apps).length;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
      <Title>Pick your apps</Title>
      <Body dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
        Tap the ones that pull you in. You can change these any time.
      </Body>

      {suggestions.map((a) => {
        const added = !!apps[a.packageName];
        return (
          <Card
            key={a.packageName}
            onPress={() => (added ? actions.removeApp(a.packageName) : actions.addApp(a.packageName, a.label, a.icon))}
            tone={added ? 'primarySoft' : 'card'}
            style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppAvatar icon={a.icon} />
              <Heading style={{ fontSize: 16, flex: 1, marginLeft: spacing.md }}>{a.label}</Heading>
              <Ionicons name={added ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={added ? '#0E7C7B' : '#8A9694'} />
            </View>
          </Card>
        );
      })}

      <Button title="Browse all apps" variant="ghost" icon="apps" onPress={() => router.push('/picker')} style={{ marginTop: spacing.sm }} />

      <View style={{ flex: 1 }} />
      <Button title={count > 0 ? `Done — watching ${count}` : 'Skip for now'} icon="checkmark" onPress={onDone} style={{ marginTop: spacing.xl }} />
    </ScrollView>
  );
}
