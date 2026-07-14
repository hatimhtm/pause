import * as Haptics from 'expo-haptics';

import { currentState } from './store';

/** Light selection tick for taps/toggles. No-op when haptics are off in settings. */
export function tap() {
  if (!currentState().settings.haptics) return;
  Haptics.selectionAsync().catch(() => {});
}
