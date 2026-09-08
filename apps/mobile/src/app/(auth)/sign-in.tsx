import { useCallback, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useAuth, useSSO } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Cards, GoogleLogo } from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

// Closes the in-app browser tab left behind on Android after the OAuth
// redirect. Without this the user lands back on a dead tab.
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: Linking.createURL("/(tabs)"),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
        return;
      }

      // No session and no throw means the user backed out of the browser.
      // That is not an error worth shouting about.
    } catch {
      setError("Could not sign in. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [startSSOFlow, router]);

  if (isLoaded && isSignedIn) return <Redirect href="/(tabs)" />;

  return (
    <View className="flex-1 bg-bg px-gutter" style={{ paddingTop: insets.top + 70 }}>
      <View className="h-14 w-14 items-center justify-center rounded-[18px] bg-clay">
        <Cards size={28} color="#FFFFFF" weight="regular" />
      </View>

      <Text variant="hero" className="mt-8">
        Learn it{"\n"}once.
      </Text>

      <Text variant="bodyLarge" className="mt-4 max-w-[300px] text-ink-muted">
        Turn any topic, PDF or photo of your notes into flashcards and a quiz that
        remembers what you got wrong.
      </Text>

      <View className="flex-1" />

      <View style={{ paddingBottom: insets.bottom + 32 }}>
        {error ? (
          <Text variant="caption" className="mb-3 text-center text-danger">
            {error}
          </Text>
        ) : null}

        <Button
          label="Continue with Google"
          icon={GoogleLogo}
          loading={busy}
          disabled={!isLoaded}
          onPress={signIn}
        />

        <Text variant="caption" className="mt-4 px-1 text-center">
          By continuing you agree to our Terms and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
