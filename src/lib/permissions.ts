import { useCallback, useState } from 'react';

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
  return { perm, refresh };
}
