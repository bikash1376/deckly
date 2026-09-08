import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ONBOARDING_KEY } from "./onboarding";

/**
 * Sends a first-time user through onboarding before the sign in screen.
 *
 * The check runs here rather than in the root layout so it never delays the
 * launch path for a user who is already signed in: that route never mounts this
 * group at all.
 */
export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    SecureStore.getItemAsync(ONBOARDING_KEY)
      .catch(() => null)
      .then((seen) => {
        if (cancelled) return;
        // Already on the onboarding screen, so nothing to do. Without this the
        // redirect fires again on every render of that screen.
        const onOnboarding = segments[segments.length - 1] === "onboarding";
        if (!seen && !onOnboarding) router.replace("/(auth)/onboarding");
        setChecked(true);
      });

    return () => {
      cancelled = true;
    };
    // Deliberately runs once. Re-running on every segment change would fight
    // the user's own navigation between the two screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) return <View className="flex-1 bg-bg" />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
