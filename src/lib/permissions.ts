import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { Native } from './native';

export type PermState = {
  accessibility: boolean;
  serviceRunning: boolean;
  usage: boolean;
  notifications: boolean;
};

export function readPermissions(): PermState {
  return {
    accessibility: Native.isAccessibilityEnabled(),
    serviceRunning: Native.isServiceRunning(),
    usage: Native.hasUsageAccess(),
    notifications: Native.isNotificationAccessEnabled(),
  };
}

export function usePermissions() {
  const [perm, setPerm] = useState<PermState>(readPermissions);
  const refresh = useCallback(() => setPerm(readPermissions()), []);

  // Granting happens in the system Settings app, which is an AppState round-trip, not a
  // navigation event — so re-read every time Pause comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { perm, refresh };
}
