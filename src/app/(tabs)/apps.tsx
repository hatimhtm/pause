import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useStore } from '@/lib/store';
import type { MonitoredApp } from '@/lib/types';
import { spacing, useAppTheme } from '@/theme';
import { AppAvatar, Body, Button, Card, Heading, Screen, Title } from '@/ui/kit';

function summarize(app: MonitoredApp): string {
  const parts: string[] = [];
  if (app.enabled) parts.push(`${app.breathSeconds}s pause`);
  else parts.push('pause off');
  if (app.muteNotifications) parts.push('notifications muted');
  return parts.join(' · ');
}

export default function AppsScreen() {
  const c = useAppTheme();
  const router = useRouter();
  const { apps } = useStore();
  const list = Object.values(apps).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <Title>Watched apps</Title>
        <Button title="Add" icon="add" onPress={() => router.push('/picker')} style={{ paddingVertical: 10, paddingHorizontal: spacing.lg }} />
      </View>

      {list.length === 0 ? (
        <Card>
          <Heading style={{ fontSize: 17, marginBottom: spacing.xs }}>Nothing watched yet</Heading>
          <Body dim>
            Add the apps that pull you in — Instagram, TikTok, YouTube, whatever. Pause puts a calm
            breath in front of them without ever locking them.
          </Body>
          <Button title="Choose apps" icon="add" onPress={() => router.push('/picker')} style={{ marginTop: spacing.lg }} />
        </Card>
      ) : (
        list.map((app) => (
          <Card key={app.packageName} onPress={() => router.push(`/config/${app.packageName}`)} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppAvatar icon={app.icon} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Heading style={{ fontSize: 16 }}>{app.label}</Heading>
                <Body faint style={{ fontSize: 12.5 }}>
                  {summarize(app)}
                </Body>
              </View>
              <Body faint>›</Body>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
