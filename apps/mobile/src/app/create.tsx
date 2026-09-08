import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { X, FilePdf, Camera, Sparkle, PencilSimple } from "phosphor-react-native";
import { CREDIT_COST, type SourceKind } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { useCreateDeck, useCreateDeckFromPdf, useCreateManualDeck } from "@/features/decks/hooks";
import { useMe } from "@/features/me/hooks";
import { ApiError } from "@/lib/api";
import { raw } from "@/theme";

/** Beyond this a topic is really pasted material, so we treat it as such. */
const TEXT_THRESHOLD = 400;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export default function CreateDeckScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; uri: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useMe();
  const createDeck = useCreateDeck();
  const createFromPdf = useCreateDeckFromPdf();
  const createManual = useCreateManualDeck();

  const cost = CREDIT_COST.seed;
  const credits = me?.entitlement.credits ?? 0;
  const affordable = credits >= cost;

  const sourceKind: Exclude<SourceKind, "pdf"> =
    text.trim().length > TEXT_THRESHOLD ? "text" : "topic";

  const busy = createDeck.isPending || createFromPdf.isPending;
  const canSubmit = useMemo(
    () => (attachment ? true : text.trim().length >= 3) && !busy,
    [attachment, text, busy],
  );

  const pickPdf = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const file = result.assets[0];
    if ((file.size ?? 0) > MAX_PDF_BYTES) {
      setError("That PDF is over 20 MB. Try splitting it or picking a shorter section.");
      return;
    }

    // Nothing is sent yet. The file is sent as the body of the create request,
    // read for its text, and never stored.
    setAttachment({ name: file.name, uri: file.uri });
  }, []);

  const pickPhoto = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera access is off. Turn it on in Settings to scan your notes.");
      return;
    }
    // OCR runs on device first, so the route to a deck from a photo is handled
    // by the scan screen rather than here.
    router.push("/scan");
  }, [router]);

  const submit = useCallback(async () => {
    setError(null);
    try {
      const deck = attachment
        ? await createFromPdf.mutateAsync({ uri: attachment.uri, fileName: attachment.name })
        : await createDeck.mutateAsync({ sourceKind, source: text.trim() });
      router.replace(`/deck/${deck.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isOutOfCredits) {
        router.replace("/paywall");
        return;
      }
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not create that deck. Try again in a moment.",
      );
    }
  }, [createDeck, createFromPdf, sourceKind, attachment, text, router]);

  /**
   * Build the deck by hand instead of generating it.
   *
   * Uses whatever is already typed as the title, so there is no second form to
   * fill in. Costs nothing, and stays available when credits have run out,
   * which is the whole point of having it.
   */
  const buildManually = useCallback(async () => {
    const title = text.trim();
    if (title.length < 2) {
      setError("Type what the deck is about first, then build it yourself.");
      return;
    }
    setError(null);
    try {
      const deck = await createManual.mutateAsync({ title, subject: "General" });
      router.replace(`/deck/${deck.id}/edit-flashcards`);
    } catch {
      setError("Could not create that deck. Try again in a moment.");
    }
  }, [text, createManual, router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-bg"
    >
      <View className="items-center pb-1 pt-3.5">
        <View className="h-1 w-9 rounded-pill bg-hairline" />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-start justify-between">
          <Text variant="title" className="max-w-[230px]">
            What are you studying?
          </Text>
          <IconButton
            icon={X}
            tone="sunken"
            size="sm"
            accessibilityLabel="Close"
            onPress={() => router.back()}
          />
        </View>

        {attachment ? (
          <View className="mt-6 flex-row items-center gap-3 rounded-tile border-[1.5px] border-ink bg-surface p-4">
            <FilePdf size={24} color={raw.clay} weight="regular" />
            <View className="flex-1">
              <Text variant="subheading" numberOfLines={1}>
                {attachment.name}
              </Text>
              <Text variant="caption">Read on send, never stored</Text>
            </View>
            <IconButton
              icon={X}
              tone="bare"
              size="sm"
              accessibilityLabel="Remove file"
              onPress={() => setAttachment(null)}
            />
          </View>
        ) : (
          <>
            <Input
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              placeholder="A topic, or paste your notes here"
              containerClassName="mt-6"
              className="min-h-[112px]"
            />
            {sourceKind === "text" ? (
              <Chip label="Reading this as your notes" tone="clay" className="mt-3" />
            ) : null}

            <Text variant="overline" className="mb-3 mt-7">
              Or start from
            </Text>
            <View className="flex-row gap-2.5">
              <SourceTile icon={FilePdf} label="Choose PDF" onPress={pickPdf} />
              <SourceTile icon={Camera} label="Photo of notes" onPress={pickPhoto} />
            </View>
            <Text variant="caption" className="mt-3.5">
              Photos are read on your device. Handwriting uses 2 extra credits.
            </Text>

            <View className="mt-6 h-px bg-hairline" />

            <Button
              label="Build the cards myself"
              variant="secondary"
              size="md"
              icon={PencilSimple}
              className="mt-6"
              loading={createManual.isPending}
              onPress={buildManually}
            />
            <Text variant="caption" className="mt-2 text-center">
              Free, and no credits used.
            </Text>
          </>
        )}

        {error ? (
          <Text variant="caption" className="mt-4 text-danger">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View className="px-gutter" style={{ paddingBottom: insets.bottom + 20 }}>
        <View className="mb-3 flex-row items-center justify-between">
          <Text variant="caption">Costs {cost} credits</Text>
          <Text variant="caption" className={affordable ? "text-ink" : "text-danger"}>
            {credits} left this month
          </Text>
        </View>
        <Button
          label={affordable ? "Create deck" : "Get more credits"}
          icon={affordable ? Sparkle : undefined}
          loading={busy}
          disabled={!canSubmit && affordable}
          onPress={affordable ? submit : () => router.push("/paywall")}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function SourceTile({
  icon: IconComponent,
  label,
  onPress,
  busy,
}: {
  icon: typeof FilePdf;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy }}
      onPress={onPress}
      disabled={busy}
      className="flex-1 items-center gap-2.5 rounded-tile border-[1.5px] border-dashed border-hairline px-3 py-5"
    >
      <IconComponent size={26} color={raw.inkFaint} weight="regular" />
      <Text variant="label">{busy ? "Uploading" : label}</Text>
    </Pressable>
  );
}
