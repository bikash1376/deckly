import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { ArrowLeft, Cards } from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";

const SUPPORT_EMAIL = "help@retenit.app";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const version = Constants.expoConfig?.version ?? "1.0.0";
  const build = Constants.expoConfig?.android?.versionCode ?? "dev";

  return (
    <ScrollView
      contentContainerClassName="px-gutter pb-12"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />

      <View className="mt-6 h-14 w-14 items-center justify-center rounded-[18px] bg-clay">
        <Cards size={28} color="#FFFFFF" weight="regular" />
      </View>

      <Text variant="display" className="mt-5">
        Retenit
      </Text>
      <Text variant="caption" className="mt-1">
        Version {version} ({String(build)})
      </Text>

      <Text variant="bodyLarge" className="mt-6 text-ink-muted">
        Most study apps help you make notes. The making is the easy part. Retenit exists
        for the other half: it turns what you are studying into flashcards and questions,
        then keeps asking you about them until you actually know them.
      </Text>

      <Card className="mt-6 gap-4 p-4">
        <View>
          <Text variant="overline" className="mb-1">
            Your work is yours
          </Text>
          <Text variant="body" className="text-ink-muted">
            PDFs are read for their text and thrown away, never stored. Spell checking runs
            on your device. You can delete any deck, note or your whole account at any time.
          </Text>
        </View>

        <View>
          <Text variant="overline" className="mb-1">
            About the AI
          </Text>
          <Text variant="body" className="text-ink-muted">
            Generated material can be wrong. Check anything that matters against your own
            source, and use the flag on a card to report something bad.
          </Text>
        </View>
      </Card>

      <Text variant="overline" className="mb-2 mt-7">
        Get in touch
      </Text>
      <Text
        variant="body"
        className="text-clay"
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
      >
        {SUPPORT_EMAIL}
      </Text>
    </ScrollView>
  );
}
