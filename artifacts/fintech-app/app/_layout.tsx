import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FinanceProvider } from '@/context/FinanceContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { logCrash } from '@/utils/crashLog';

SplashScreen.preventAutoHideAsync();

// Registered at module load, before any component renders — catches uncaught
// JS errors app-wide (not just render-phase ones, which is all ErrorBoundary
// sees). Chains to RN's own default handler rather than replacing it, so
// existing behavior (e.g. the dev red-box) still happens too.
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorUtils = (global as any).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const defaultHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      logCrash(error, 'global', !!isFatal).finally(() => {
        defaultHandler?.(error, isFatal);
      });
    });
  }
} catch {
  // If ErrorUtils isn't available in this environment, just skip — the
  // ErrorBoundary below still covers render-phase errors either way.
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  useNetworkStatus();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-transaction"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="add-goal"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="add-account"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="add-budget"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="recurring"
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Failsafe: if something hangs before fonts ever resolve (a broken native
  // module, a stuck promise, anything), don't leave the user staring at the
  // splash screen forever. Force the app to proceed after 6s — worst case
  // you see a real (debuggable) screen instead of a permanently frozen icon.
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
      setForceReady(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontError && !forceReady) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={(error) => { logCrash(error, 'boundary', true); }}>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <FinanceProvider>
                <RootLayoutNav />
              </FinanceProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
