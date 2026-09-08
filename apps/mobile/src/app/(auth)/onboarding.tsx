import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import {
  FilePdf,
  Camera,
  TextAa,
  Cards,
  Lightning,
  ChatCircle,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { prefetchOcrModel } from "@/features/ocr";
import { cn } from "@/lib/cn";
import { raw, shadow } from "@/theme";

export const ONBOARDING_KEY = "deckly.onboarded.v1";

const { width } = Dimensions.get("window");

/**
 * Three slides, not seven.
 *
 * Each one earns its place by answering a different question: what do I put in,
 * what do I get back, and why would I open this again tomorrow. That last one
 * is the whole product, so it is the slide immediately before the button.
 */
const SLIDES = [
  {
    key: "input",
    eyebrow: "Start anywhere",
    title: "A topic, a PDF,\nor a photo\nof your notes.",
    body: "Type what you are studying, drop in a lecture PDF, or point your camera at a page.",
    tone: "slate" as const,
    icons: [TextAa, FilePdf, Camera],
  },
  {
    key: "output",
    eyebrow: "Get what you need",
    title: "Summary,\nflashcards,\nand a quiz.",
    body: "The TL;DR arrives in seconds. Generate the rest only when you want it, so nothing is wasted.",
    tone: "clay" as const,
    icons: [Cards, ChatCircle],
  },
  {
    key: "recall",
    eyebrow: "Actually remember it",
    title: "It asks you\nagain, right\nbefore you\nforget.",
    body: "Cards you find hard come back sooner. Reviewing is free and always will be.",
    tone: "eucalyptus" as const,
    icons: [Lightning],
  },
];

const TONE_BG: Record<string, string> = {
  slate: "bg-slate",
  clay: "bg-clay",
  eucalyptus: "bg-eucalyptus",
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }, []);

  // Pull the OCR model down while the user is reading, so the first time they
  // point the camera at a page there is nothing to wait for.
  useEffect(() => {
    prefetchOcrModel();
  }, []);

  const finish = useCallback(async () => {
    // A failed write costs the user one repeat of onboarding, which is a much
    // smaller problem than blocking sign in behind a keystore error.
    await SecureStore.setItemAsync(ONBOARDING_KEY, "1").catch(() => {});
    router.replace("/(auth)/sign-in");
  }, [router]);

  const advance = useCallback(() => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }, [index, finish]);

  const slide = SLIDES[index]!;

  return (
    <View className={cn("flex-1", TONE_BG[slide.tone])}>
      <View
        className="flex-row items-center justify-between px-gutter"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View className="flex-row gap-1.5">
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              className={cn(
                "h-1 rounded-pill",
                i === index ? "w-7 bg-ink-inverse" : "w-3.5 bg-ink-inverse/35",
              )}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          onPress={finish}
          hitSlop={12}
        >
          <Text variant="label" className="text-ink-inverse/70">
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        className="flex-1"
      >
        {SLIDES.map((item) => (
          <View key={item.key} style={{ width }} className="flex-1 justify-center px-gutter">
            {/* Loose stack of cards, echoing the deck the app is named for. */}
            <View className="h-[210px] items-center justify-center">
              <View className="flex-row items-center gap-3">
                {item.icons.map((Icon: PhosphorIcon, i) => (
                  <Animated.View
                    key={i}
                    entering={FadeIn.delay(i * 90).duration(320)}
                    style={[shadow.floating, { transform: [{ rotate: `${(i - 1) * 5}deg` }] }]}
                    className="h-[104px] w-[84px] items-center justify-center rounded-tile bg-surface"
                  >
                    <Icon size={30} color={raw.ink} weight="regular" />
                  </Animated.View>
                ))}
              </View>
            </View>

            <Text variant="overline" className="mt-10 text-ink-inverse/70">
              {item.eyebrow}
            </Text>
            <Text variant="hero" className="mt-2 text-ink-inverse">
              {item.title}
            </Text>
            <Text variant="bodyLarge" className="mt-4 max-w-[300px] text-ink-inverse/80">
              {item.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="px-gutter" style={{ paddingBottom: insets.bottom + 28 }}>
        <Button
          label={index >= SLIDES.length - 1 ? "Get started" : "Next"}
          variant="inverse"
          onPress={advance}
        />
      </View>
    </View>
  );
}
