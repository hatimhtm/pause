import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { light, success, tap } from '@/lib/haptics';
import { Native } from '@/lib/native';
import { usePermissions, type PermState } from '@/lib/permissions';
import { actions, useStoreSelector } from '@/lib/store';
import type { InstalledApp } from '@/lib/types';
import { palette, radius, spacing, useAppTheme } from '@/theme';
import { Appear, AppAvatar, Body, Button, Card, Heading, Spinner, Title } from '@/ui/kit';

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

/** Progress dot that glides between its states — the tab-pill curve, not a snap. */
function Dot({ active }: { active: boolean }) {
  const c = useAppTheme();
  const t = useDerivedValue(() => withTiming(active ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) }));
  const aStyle = useAnimatedStyle(() => ({
    width: 7 + t.value * 15,
    opacity: 0.55 + t.value * 0.45,
  }));
  return (
    <Animated.View
      style={[{ height: 7, borderRadius: 4, backgroundColor: active ? c.primary : c.border }, aStyle]}
    />
  );
}

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
          <Dot key={i} active={i === step} />
        ))}
      </View>

      {step === 0 ? <Welcome onNext={() => setStep(1)} /> : null}
      {step === 1 ? <Permissions perm={perm} onOpen={refresh} onNext={() => setStep(2)} /> : null}
      {step === 2 ? <PickApps onDone={finish} /> : null}
    </SafeAreaView>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <ScrollView key="welcome" contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
      <Appear index={0}>
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
      </Appear>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Appear index={1}>
          <Point icon="leaf" title="It never blocks you" body="Open anything you like — Pause just adds a short breath first, so the mindless opens fade away." />
        </Appear>
        <Appear index={2}>
          <Point icon="stats-chart" title="Honest numbers" body="See time spent, how often you reach for each app, and how often you chose to walk away." />
        </Appear>
        <Appear index={3}>
          <Point icon="lock-closed" title="Yours alone" body="Everything stays on this phone. No accounts, no servers, nothing uploaded." />
        </Appear>
      </View>

      <View style={{ flex: 1 }} />
      <Appear index={4}>
        <Button title="Get started" icon="arrow-forward" onPress={onNext} style={{ marginTop: spacing.xxl }} />
      </Appear>
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
  perm: PermState;
  onOpen: () => void;
  onNext: () => void;
}) {
  // One success haptic per grant round-trip, even if two permissions flip together.
  const prev = useRef(perm);
  useEffect(() => {
    const was = prev.current;
    prev.current = perm;
    const flipped =
      (!was.accessibility && perm.accessibility) ||
      (!was.usage && perm.usage) ||
      (!was.notifications && perm.notifications);
    if (flipped) success();
  }, [perm]);

  return (
    <ScrollView key="permissions" contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
      <Appear index={0}>
        <Title>A few permissions</Title>
        <Body dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          Grant these in Settings, then come back. Only the first is required.
        </Body>
      </Appear>

      <Appear index={1}>
        <PermCard
          granted={perm.accessibility}
          title="Accessibility service"
          why="How Pause notices which app opens so it can show the breathing screen. Required."
          note="Android will show a serious-sounding warning — it does for every app like this. Pause only sees which app comes to the front. Nothing leaves this phone."
          onPress={() => { Native.openAccessibilitySettings(); onOpen(); }}
        />
      </Appear>
      <Appear index={2}>
        <PermCard
          granted={perm.usage}
          title="Usage access"
          why="Powers the honest stats — time spent and opens per app."
          onPress={() => { Native.openUsageAccessSettings(); onOpen(); }}
        />
      </Appear>
      <Appear index={3}>
        <PermCard
          granted={perm.notifications}
          title="Notification access"
          why="Optional. Lets Pause mute notifications from apps you mute or during quiet hours."
          onPress={() => { Native.openNotificationAccessSettings(); onOpen(); }}
        />
      </Appear>

      <View style={{ flex: 1 }} />
      <Appear index={4}>
        <Button
          title={perm.accessibility ? 'Continue' : 'Grant accessibility to continue'}
          icon="arrow-forward"
          disabled={!perm.accessibility}
          onPress={onNext}
          style={{ marginTop: spacing.xl }}
        />
      </Appear>
    </ScrollView>
  );
}

function PermCard({
  granted,
  title,
  why,
  note,
  onPress,
}: {
  granted: boolean;
  title: string;
  why: string;
  note?: string;
  onPress: () => void;
}) {
  const c = useAppTheme();
  // The checkmark earns an entrance only when it flips after mount — already-granted stays quiet.
  const mountedGranted = useRef(granted);
  return (
    <Card tone={granted ? 'primarySoft' : 'card'} style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        {granted && !mountedGranted.current ? (
          <Animated.View entering={ZoomIn.duration(320).easing(Easing.out(Easing.back(2)))}>
            <Ionicons name="checkmark-circle" size={22} color={c.primary} />
          </Animated.View>
        ) : (
          <Ionicons
            name={granted ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={granted ? c.primary : c.textFaint}
          />
        )}
        <Heading style={{ fontSize: 16, marginLeft: spacing.sm }}>{title}</Heading>
      </View>
      <Body dim style={{ fontSize: 13 }}>{why}</Body>
      {!granted && note ? (
        <Body faint style={{ fontSize: 12.5, marginTop: spacing.sm }}>
          {note}
        </Body>
      ) : null}
      {!granted ? <Button title="Open settings" variant="ghost" onPress={onPress} style={{ marginTop: spacing.md }} /> : null}
    </Card>
  );
}

function PickApps({ onDone }: { onDone: () => void }) {
  const c = useAppTheme();
  const router = useRouter();
  const apps = useStoreSelector((s) => s.apps);
  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);

  useEffect(() => {
    Native.getInstalledApps().then(setInstalled);
  }, []);

  const suggestions = (installed ?? []).filter((a) => POPULAR.includes(a.packageName));
  const count = Object.keys(apps).length;

  return (
    <ScrollView key="pick" contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}>
      <Appear index={0}>
        <Title>Pick your apps</Title>
        <Body dim style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          Tap the ones that pull you in. You can change these any time.
        </Body>
      </Appear>

      {installed === null ? (
        <Spinner />
      ) : (
        <>
          {suggestions.map((a, i) => {
            const added = !!apps[a.packageName];
            return (
              <Appear key={a.packageName} index={1 + i}>
                <Card
                  haptic={false}
                  onPress={() => {
                    if (added) {
                      tap();
                      actions.removeApp(a.packageName);
                    } else {
                      light();
                      actions.addApp(a.packageName, a.label, a.icon);
                    }
                  }}
                  tone={added ? 'primarySoft' : 'card'}
                  style={{ marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AppAvatar icon={a.icon} />
                    <Heading style={{ fontSize: 16, flex: 1, marginLeft: spacing.md }} numberOfLines={1}>
                      {a.label}
                    </Heading>
                    <Ionicons
                      name={added ? 'checkmark-circle' : 'add-circle-outline'}
                      size={24}
                      color={added ? c.primary : c.textFaint}
                    />
                  </View>
                </Card>
              </Appear>
            );
          })}

          <Appear index={2 + suggestions.length}>
            <Button title="Browse all apps" variant="ghost" icon="apps" onPress={() => router.push('/picker')} style={{ marginTop: spacing.sm }} />
          </Appear>

          {count > 0 && Native.canPreviewBreathe() ? (
            <Appear index={3 + suggestions.length}>
              <Button
                title="Preview the pause"
                variant="ghost"
                icon="eye"
                onPress={() => Native.previewBreathe()}
                style={{ marginTop: spacing.sm }}
              />
            </Appear>
          ) : null}
        </>
      )}

      <View style={{ flex: 1 }} />
      <Button
        title={count > 0 ? `Done — watching ${count}` : 'Skip for now'}
        icon="checkmark"
        onPress={onDone}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}
