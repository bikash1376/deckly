import { useCallback, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  CameraIcon as Camera,
  ImagesIcon as Images,
  XIcon as X,
  SparkleIcon as Sparkle,
} from "phosphor-react-native";
import { CREDIT_COST } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { recognise } from "@/features/ocr";
import { useCreateDeck } from "@/features/decks/hooks";
import { ApiError } from "@/lib/api";
import { raw } from "@/theme";

interface Page {
  uri: string;
  text: string;
  thin: boolean;
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const createDeck = useCreateDeck();

  const [pages, setPages] = useState<Page[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (source: "camera" | "library") => {
    setError(null);

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === "camera"
          ? "Camera access is off. Turn it on in Settings to scan your notes."
          : "Photo access is off. Turn it on in Settings to pick an image.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true });

    if (result.canceled) return;

    setReading(true);
    try {
      const read = await Promise.all(
        result.assets.map(async (asset) => {
          const ocr = await recognise(asset.uri);
          return { uri: asset.uri, text: ocr.text, thin: ocr.shouldOfferFallback };
        }),
      );
      setPages((prev) => [...prev, ...read]);
    } catch {
      setError("Could not read that image. Try a clearer, straighter photo.");
    } finally {
      setReading(false);
    }
  }, []);

  const combined = pages
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n\n");
  const anyThin = pages.some((p) => p.thin);

  const create = useCallback(async () => {
    if (combined.trim().length < 20) {
      setError("There is not enough readable text yet. Add another page.");
      return;
    }
    try {
      const deck = await createDeck.mutateAsync({ sourceKind: "text", source: combined });
      router.replace(`/deck/${deck.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isOutOfCredits) {
        router.replace("/paywall");
        return;
      }
      setError("Could not create that deck. Try again in a moment.");
    }
  }, [combined, createDeck, router]);

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-start justify-between px-gutter">
        <View className="flex-1">
          <Text variant="title">Scan your notes</Text>
          <Text variant="caption" className="mt-1">
            Read on your device. Nothing is uploaded unless you make a deck.
          </Text>
        </View>
        <IconButton
          icon={X}
          tone="sunken"
          size="sm"
          accessibilityLabel="Close"
          onPress={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="px-gutter pt-6 pb-8 gap-2.5">
        {pages.map((page, i) => (
          <Card key={`${page.uri}-${i}`} className="overflow-hidden">
            <View className="flex-row gap-3 p-3">
              <Image
                source={{ uri: page.uri }}
                className="h-20 w-16 rounded-sm bg-bg-sunken"
                resizeMode="cover"
              />
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text variant="overline">Page {i + 1}</Text>
                  {page.thin ? <Chip label="Hard to read" tone="danger" /> : null}
                </View>
                <Text variant="caption" className="mt-1" numberOfLines={4}>
                  {page.text || "No text found on this page."}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        {reading ? (
          <Card className="gap-2 p-4">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ) : null}

        {pages.length === 0 && !reading ? (
          <View className="items-center gap-3 rounded-card border-[1.5px] border-dashed border-hairline px-6 py-10">
            <Camera size={28} color={raw.inkFaint} weight="regular" />
            <Text variant="body" className="text-center text-ink-muted">
              Take a photo of a page, or pick one from your gallery. Add as many pages as
              you need and they become one deck.
            </Text>
          </View>
        ) : null}

        {anyThin ? (
          <Card className="mt-2 p-4">
            <Text variant="overline" className="text-danger">
              Some pages read poorly
            </Text>
            <Text variant="body" className="mt-1.5 text-ink-muted">
              On device reading struggles with handwriting, diagrams and maths. A stronger
              model can handle those for {CREDIT_COST.seed} extra credits.
            </Text>
            <Button
              label="Read with the stronger model"
              variant="secondary"
              size="md"
              icon={Sparkle}
              className="mt-3"
              onPress={() => router.push("/paywall")}
            />
          </Card>
        ) : null}

        <View className="mt-2 flex-row gap-2.5">
          <View className="flex-1">
            <Button
              label="Camera"
              variant="secondary"
              size="md"
              icon={Camera}
              onPress={() => add("camera")}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Gallery"
              variant="secondary"
              size="md"
              icon={Images}
              onPress={() => add("library")}
            />
          </View>
        </View>

        {error ? (
          <Text variant="caption" className="mt-2 text-danger">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {pages.length > 0 ? (
        <View className="px-gutter" style={{ paddingBottom: insets.bottom + 20 }}>
          <Text variant="caption" className="mb-2 text-center">
            {combined.length} characters from {pages.length}{" "}
            {pages.length === 1 ? "page" : "pages"}
          </Text>
          <Button
            label="Make a deck from this"
            icon={Sparkle}
            loading={createDeck.isPending}
            onPress={create}
          />
        </View>
      ) : null}
    </View>
  );
}
