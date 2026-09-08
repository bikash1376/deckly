import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  WarningIcon as Warning,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./ui/text";
import { Button } from "./ui/button";
import { raw } from "@/theme";

/**
 * Rendered by expo-router when a route throws.
 *
 * It says what the user can do, not what went wrong internally. A stack trace
 * helps nobody holding a phone, and the real error is already in the console
 * for a dev build and in the crash report for a release one.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (__DEV__) console.error("route error", error);

  return (
    <View
      className="flex-1 items-center justify-center bg-bg px-gutter"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="h-16 w-16 items-center justify-center rounded-tile bg-bg-sunken">
        <Warning size={28} color={raw.inkFaint} weight="regular" />
      </View>

      <Text variant="title" className="mt-5 text-center">
        This screen stopped working
      </Text>
      <Text variant="body" className="mt-2 max-w-[300px] text-center text-ink-muted">
        Your decks and notes are safe. Try again, and if it keeps happening, go back and
        open it fresh.
      </Text>

      {__DEV__ ? (
        <Text variant="caption" className="mt-4 max-w-[320px] text-center text-danger" raw>
          {error.message}
        </Text>
      ) : null}

      <View className="mt-7 w-full gap-2.5">
        <Button label="Try again" onPress={() => retry()} />
        <Button
          label="Go back"
          variant="secondary"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
        />
      </View>
    </View>
  );
}
