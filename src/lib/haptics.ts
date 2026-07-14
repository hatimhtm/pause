import * as Haptics from 'expo-haptics';

import { currentState } from './store';

function enabled(): boolean {
  return currentState().settings.haptics;
}

/** Light selection tick — ordinary taps and toggles. */
export function tap() {
  if (!enabled()) return;
  Haptics.selectionAsync().catch(() => {});
}

/** Slightly weighted — meaningful state changes (adding an app to the watch list). */
export function light() {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Reserved for rare, earned wins (a permission turning green). Never in a repeat-tap list. */
export function success() {
  if (!enabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Medium impact — gesture recognition (long-press). */
export function impact() {
  if (!enabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
