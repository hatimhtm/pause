import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import '@/global.css';
import { hydrate, useHydrated, useStore } from '@/lib/store';

SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    if (hydrated && !settings.onboardingComplete) {
      router.replace('/onboarding');
    }
  }, [hydrated, settings.onboardingComplete, router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="picker" options={{ presentation: 'modal' }} />
        <Stack.Screen name="config/[pkg]" />
      </Stack>
    </>
  );
}
