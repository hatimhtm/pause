import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, View } from 'react-native';

import { impact, tap } from '@/lib/haptics';
import { actions, useStoreSelector } from '@/lib/store';
import type { MonitoredApp } from '@/lib/types';
import { radius, spacing, useAppTheme } from '@/theme';
import { Appear, AppAvatar, Body, Button, Card, Heading, PressableScale, Screen, Title } from '@/ui/kit';

function summarize(app: MonitoredApp): string {
  const parts: string[] = [];
  if (app.enabled) parts.push(`${app.breathSeconds}s pause`);
  else parts.push('pause off');
  if (app.muteNotifications) parts.push('notifications muted');
  return parts.join(' · ');
}

/** Long-press quick actions — the day-to-day toggles without the four-tap round trip. */
function QuickSheet({ app, onClose }: { app: MonitoredApp | null; onClose: () => void }) {
  const c = useAppTheme();
  const router = useRouter();
  if (!app) return null;
  const row = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    onPress: () => void,
  ) => (
    <PressableScale
      scaleTo={0.98}
      onPress={() => {
        tap();
        onPress();
        onClose();
      }}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
      <Ionicons name={icon} size={20} color={c.text} style={{ marginRight: spacing.md }} />
      <Body style={{ fontSize: 16 }}>{title}</Body>
    </PressableScale>
  );
  return (
    <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <PressableScale scaleTo={1} onPress={onClose} style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: c.bgElevated,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xxxl,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <AppAvatar icon={app.icon} size={36} />
            <Heading style={{ fontSize: 18, marginLeft: spacing.md, flex: 1 }} numberOfLines={1}>
              {app.label}
            </Heading>
          </View>
          {row(
            app.enabled ? 'play' : 'pause',
            app.enabled ? 'Turn the pause off' : 'Turn the pause on',
            () => actions.updateApp(app.packageName, { enabled: !app.enabled }),
          )}
          {row(
            app.muteNotifications ? 'notifications' : 'notifications-off',
            app.muteNotifications ? 'Unmute notifications' : 'Mute notifications',
            () => actions.updateApp(app.packageName, { muteNotifications: !app.muteNotifications }),
          )}
          {row('settings-outline', 'All settings…', () => router.push(`/config/${app.packageName}`))}
          <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      </PressableScale>
    </Modal>
  );
}

export default function AppsScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const apps = useStoreSelector((s) => s.apps);
  const [sheetApp, setSheetApp] = useState<MonitoredApp | null>(null);
  const list = useMemo(
    () => Object.values(apps).sort((a, b) => a.label.localeCompare(b.label)),
    [apps],
  );

  return (
    <Screen>
      <QuickSheet app={sheetApp ? apps[sheetApp.packageName] ?? null : null} onClose={() => setSheetApp(null)} />
      <Appear index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <Title>Watched apps</Title>
          <Button title="Add" icon="add" onPress={() => router.push('/picker')} style={{ paddingVertical: 10, paddingHorizontal: spacing.lg }} />
        </View>
      </Appear>

      {list.length === 0 ? (
        <Appear index={1}>
          <Card>
            <Heading style={{ fontSize: 16, marginBottom: spacing.xs }}>Nothing watched yet</Heading>
            <Body dim>
              Add the apps that pull you in — Instagram, TikTok, YouTube, whatever. Pause puts a calm
              breath in front of them without ever locking them.
            </Body>
            <Button title="Choose apps" icon="add" onPress={() => router.push('/picker')} style={{ marginTop: spacing.lg }} />
          </Card>
        </Appear>
      ) : (
        list.map((app, i) => (
          <Appear key={app.packageName} index={1 + i}>
            <Card
              onPress={() => router.push(`/config/${app.packageName}`)}
              onLongPress={() => {
                impact();
                setSheetApp(app);
              }}
              style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppAvatar icon={app.icon} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Heading style={{ fontSize: 16 }} numberOfLines={1}>
                    {app.label}
                  </Heading>
                  <Body faint style={{ fontSize: 12.5 }}>
                    {summarize(app)}
                  </Body>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
              </View>
            </Card>
          </Appear>
        ))
      )}
    </Screen>
  );
}
