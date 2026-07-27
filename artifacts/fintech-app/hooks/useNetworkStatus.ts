import { useEffect, useRef } from 'react';
import { useFinance } from '@/context/FinanceContext';

// Loaded lazily and defensively: if the native module isn't linked correctly
// (version mismatch with what `expo prebuild` generated, etc.), a *static*
// `import NetInfo from '@react-native-community/netinfo'` at the top of this
// file can throw during JS bundle initialization — before React even starts,
// before fonts load, before ErrorBoundary exists to catch anything. That's
// exactly the kind of failure that leaves an app stuck on the native splash
// screen forever. Requiring it lazily inside a try/catch means a broken or
// missing native module degrades to "offline detection doesn't work" instead
// of "the entire app won't launch."
type NetInfoModule = typeof import('@react-native-community/netinfo');
let netInfoModule: NetInfoModule['default'] | null = null;
let netInfoLoadAttempted = false;

function getNetInfo(): NetInfoModule['default'] | null {
  if (netInfoLoadAttempted) return netInfoModule;
  netInfoLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    netInfoModule = require('@react-native-community/netinfo').default;
  } catch (err) {
    console.warn(
      '[useNetworkStatus] @react-native-community/netinfo failed to load — ' +
        'offline detection disabled, rest of the app continues normally.',
      err,
    );
    netInfoModule = null;
  }
  return netInfoModule;
}

/**
 * Listens for real device connectivity changes (not just "did our last fetch
 * fail"), and drains the offline sync queue automatically the moment the
 * device comes back online. Mount this once, inside <FinanceProvider>.
 * Safe to call even if the native module isn't available — see getNetInfo().
 */
export function useNetworkStatus() {
  const { setOffline, drainSyncQueue } = useFinance();
  const wasOffline = useRef(false);

  useEffect(() => {
    const NetInfo = getNetInfo();
    if (!NetInfo) return; // Degrade gracefully — no crash, offline detection just won't fire.

    try {
      const unsubscribe = NetInfo.addEventListener((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        setOffline(offline);

        if (wasOffline.current && !offline) {
          drainSyncQueue().catch(() => {
            // Individual item failures are already tracked per-item in the queue.
          });
        }
        wasOffline.current = offline;
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('[useNetworkStatus] addEventListener failed:', err);
      return undefined;
    }
  }, [setOffline, drainSyncQueue]);
}
