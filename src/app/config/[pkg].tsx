import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { actions, useStore } from '@/lib/store';
import { spacing, useAppTheme } from '@/theme';
import { AppAvatar, Body, Button, Card, Chips, Heading, Label, Screen, ToggleRow } from '@/ui/kit';

const BREATH_OPTIONS = [15, 20, 30, 45, 60];

export default function AppConfigScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { pkg } = useLocalSearchParams<{ pkg: string }>();
  const { apps } = useStore();
  const app = pkg ? apps[pkg] : undefined;

  if (!app) {
    return (
      <Screen>
        <Body dim style={{ marginTop: spacing.xxl }}>
          This app isn’t being watched.
        </Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.md }}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <AppAvatar icon={app.icon} size={38} />
        <Heading style={{ fontSize: 22, marginLeft: spacing.md }}>{app.label}</Heading>
      </View>

      <Label style={{ marginBottom: spacing.sm }}>The pause</Label>
      <ToggleRow
        title="Show a breathing pause"
        subtitle="A short breathe screen before this app opens — you can always continue"
        value={app.enabled}
        onValueChange={(v) => actions.updateApp(app.packageName, { enabled: v })}
      />

      {app.enabled ? (
        <>
          <Card style={{ marginTop: spacing.sm }}>
            <Heading style={{ fontSize: 15, marginBottom: spacing.md }}>Make me wait</Heading>
            <Chips
              options={BREATH_OPTIONS}
              value={app.breathSeconds}
              onChange={(v) => actions.updateApp(app.packageName, { breathSeconds: v })}
              format={(v) => `${v}s`}
            />
          </Card>
          <View style={{ height: spacing.sm }} />
          <ToggleRow
            title="Ask “why are you opening it?”"
            subtitle="A gentle reflection prompt on the pause screen"
            value={app.reflection}
            onValueChange={(v) => actions.updateApp(app.packageName, { reflection: v })}
          />
        </>
      ) : null}

      <Label style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Notifications</Label>
      <ToggleRow
        title="Mute this app’s notifications"
        subtitle="Dismiss its notifications while it’s being watched"
        value={app.muteNotifications}
        onValueChange={(v) => actions.updateApp(app.packageName, { muteNotifications: v })}
      />

      <Button
        title="Stop watching this app"
        variant="danger"
        icon="trash"
        onPress={() => {
          actions.removeApp(app.packageName);
          router.back();
        }}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}
