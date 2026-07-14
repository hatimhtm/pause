import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import '@/global.css';
import { hydrate, useHydrated, useStore } from '@/lib/store';

SplashScreen.preventAutoHideAsync();

// The foreground listener would otherwise hit the update server dozens of times a day —
// on the one phone this app exists to protect. Pull-to-refresh stays the "check now" path.
let lastOtaCheck = 0;
const OTA_CHECK_INTERVAL_MS = 6 * 3600_000;

export default function RootLayout() {
  const router = useRouter();
  const scheme = useColorScheme();
  const hydrated = useHydrated();
  const { settings } = useStore();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  // Quietly fetch any OTA update whenever the app comes to the foreground; it applies on the
  // next launch. Pull-to-refresh on Today stays the "give it to me now" path.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active' || !Updates.isEnabled) return;
      if (Date.now() - lastOtaCheck < OTA_CHECK_INTERVAL_MS) return;
      lastOtaCheck = Date.now();
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) await Updates.fetchUpdateAsync();
      } catch {}
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (hydrated && !settings.onboardingComplete) {
      router.replace('/onboarding');
    }
  }, [hydrated, settings.onboardingComplete, router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="picker" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="config/[pkg]" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="attempts" />
        <Stack.Screen name="wins" />
      </Stack>
    </>
  );
}
