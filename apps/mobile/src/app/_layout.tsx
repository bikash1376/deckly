import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ClerkProvider } from "@clerk/clerk-expo";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { InterTight_600SemiBold, InterTight_700Bold } from "@expo-google-fonts/inter-tight";

import { tokenCache } from "@/lib/token-cache";
import { env } from "@/lib/env";
import { queryClient, persistOptions } from "@/lib/query-client";
import { raw } from "@/theme";

export { ErrorBoundary } from "@/components/error-boundary";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });

  useEffect(() => {
    // Hide on error too. A missing font should degrade to the system face, not
    // hold the splash screen open forever.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <View className="flex-1 bg-bg">
              <StatusBar style="dark" backgroundColor={raw.bg} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: raw.bg },
                  animation: "slide_from_right",
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="create"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen
                  name="paywall"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen name="deck/[id]" />
                <Stack.Screen name="note/[id]" />
                <Stack.Screen
                  name="scan"
                  options={{ presentation: "modal", animation: "slide_from_bottom" }}
                />
                <Stack.Screen name="search" />
                <Stack.Screen name="settings/reminders" />
              </Stack>
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistQueryClientProvider>
    </ClerkProvider>
  );
}
