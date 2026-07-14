import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { useAppTheme } from '@/theme';

const TABS: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { icon: 'pulse', label: 'Today' },
  apps: { icon: 'grid', label: 'Apps' },
  quiet: { icon: 'moon', label: 'Quiet' },
  settings: { icon: 'settings-sharp', label: 'Settings' },
};

const ITEM_WIDTH = 78;
const BAR_PADDING = 5;

/**
 * Floating glass pill: content scrolls underneath the translucent bar, and a solid pill
 * springs across to whichever tab is active.
 */
function PillTabBar({ state, navigation }: { state: any; navigation: any }) {
  const c = useAppTheme();
  const insets = useSafeAreaInsets();
  const dark = c.scheme === 'dark';

  const x = useSharedValue(state.index * ITEM_WIDTH);
  useEffect(() => {
    x.value = withSpring(state.index * ITEM_WIDTH, { damping: 15, stiffness: 170 });
  }, [state.index, x]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 12,
        alignItems: 'center',
      }}>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 999,
          padding: BAR_PADDING,
          backgroundColor: dark ? 'rgba(20, 29, 28, 0.88)' : 'rgba(255, 255, 255, 0.88)',
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: BAR_PADDING,
              bottom: BAR_PADDING,
              left: BAR_PADDING,
              width: ITEM_WIDTH,
              borderRadius: 999,
              backgroundColor: c.primary,
            },
            pillStyle,
          ]}
        />
        {state.routes.map((route: any, i: number) => {
          const focused = state.index === i;
          const tab = TABS[route.name] ?? { icon: 'ellipse' as const, label: route.name };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                tap();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ width: ITEM_WIDTH, alignItems: 'center', paddingVertical: 8 }}>
              <Ionicons name={tab.icon} size={20} color={focused ? c.onPrimary : c.textDim} />
              <Text
                style={{
                  color: focused ? c.onPrimary : c.textDim,
                  fontSize: 10.5,
                  fontWeight: '700',
                  marginTop: 2,
                }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <PillTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="apps" options={{ title: 'Apps' }} />
      <Tabs.Screen name="quiet" options={{ title: 'Quiet hours' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
