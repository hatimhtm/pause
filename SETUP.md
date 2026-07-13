# Setup & build

Detailed build, install, and over-the-air update notes for Pause.

## Requirements

- Android Studio (bundled JDK 21 is fine), Android SDK Platform 35, Android NDK (Gradle installs it
  on first build).
- An Expo account (free) for OTA updates and cloud builds.
- A device/emulator running Android 8.0 (API 26) or newer.

## First build & install

The engine is native, so the first install needs a real build (not Expo Go). Easiest is an EAS
cloud build:

```bash
npm install
npx eas-cli login
npx eas-cli init                 # links/creates the EAS project (writes extra.eas.projectId)
npx eas-cli update:configure     # wires expo-updates (sets updates.url) for OTA
npx eas-cli build -p android --profile preview   # cloud-builds an installable APK
```

Install the resulting APK on the phone (the build page gives a QR/link). Or build locally on a
connected device:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npx expo run:android --variant release
```

## Pushing updates over the air

Once a `preview`/`production` build is installed, change any TypeScript, then:

```bash
npx eas-cli update --branch preview -m "tweak onboarding copy"
```

The app pulls it on next launch — no reinstall. **Settings → Check for updates** forces a pull.
Only the JS/UI layer updates this way; native-engine changes need a fresh build.

## First-run permissions

1. **Accessibility service** *(required)* — how Pause notices which app opens. Nothing leaves the
   device; it doesn't read screen content, only the foreground package name.
2. **Usage access** *(recommended)* — powers the time / opens stats.
3. **Notification access** *(optional)* — only for notification muting.

## What the stats show

Per app and per day, from on-device usage stats + Pause's own event log:

- **Time spent** on each watched app (today and last 7 days).
- **Opens** — how many times the app was actually brought to the foreground.
- **Reached for / paused** — how many times the breathing screen appeared.
- **Backed out** — how many times the pause was shown and the app was closed instead.

## Project layout

```
modules/pause-native/android/…   Kotlin: PauseAccessibilityService (engine), BreatheActivity
                                  (native breathing screen), PauseNotificationListener,
                                  ConfigStore, EventLog, UsageQuery, InstalledApps, JS bridge.
src/lib/          native bridge, AsyncStorage config store, stats aggregation, permissions.
src/theme/        one teal design system, light + dark, phone + tablet responsive helpers.
src/ui/kit.tsx    Screen, Card, Button, StatTile, AppAvatar, ToggleRow, Chips, BarChart.
src/app/          expo-router screens: onboarding, (tabs)/{today,apps,quiet,settings},
                  picker, config/[pkg].
```
