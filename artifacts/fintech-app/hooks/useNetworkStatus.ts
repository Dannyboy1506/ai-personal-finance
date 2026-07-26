import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useFinance } from '@/context/FinanceContext';

/**
 * Listens for real device connectivity changes (not just "did our last fetch
 * fail"), and drains the offline sync queue automatically the moment the
 * device comes back online. Mount this once, inside <FinanceProvider>.
 */
export function useNetworkStatus() {
  const { setOffline, drainSyncQueue } = useFinance();
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setOffline(offline);

      if (wasOffline.current && !offline) {
        // Just came back online — try to clear anything queued while we were away.
        drainSyncQueue().catch(() => {
          // Individual item failures are already tracked per-item in the queue;
          // nothing else to do here.
        });
      }
      wasOffline.current = offline;
    });

    return () => unsubscribe();
  }, [setOffline, drainSyncQueue]);
}
