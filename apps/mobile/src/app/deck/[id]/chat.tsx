import { useCallback, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, PaperPlaneRight } from "phosphor-react-native";
import { CREDIT_COST } from "@deckly/shared";

import { Text } from "@/components/ui/text";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeck } from "@/features/decks/hooks";
import { useApi } from "@/lib/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { deckClass, raw, shadow } from "@/theme";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const Reply = z.object({ reply: z.string() });

export default function DeckChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const api = useApi();
  const listRef = useRef<FlatList<Message>>(null);

  const { data } = useDeck(id);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const ask = useMutation({
    mutationFn: (question: string) =>
      api.post(`/decks/${id}/chat`, { message: question }, Reply),
  });

  const send = useCallback(async () => {
    const question = draft.trim();
    if (!question || ask.isPending) return;

    setDraft("");
    setMessages((prev) => [
      ...prev,
      { id: `u${Date.now()}`, role: "user", text: question },
    ]);

    try {
      const { reply } = await ask.mutateAsync(question);
      setMessages((prev) => [
        ...prev,
        { id: `a${Date.now()}`, role: "assistant", text: reply },
      ]);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isOutOfCredits) {
        router.push("/paywall");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `e${Date.now()}`,
          role: "assistant",
          text: "That did not go through. Check your connection and ask again.",
        },
      ]);
    }
  }, [draft, ask, router]);

  const color = data?.deck.color ?? "slate";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      keyboardVerticalOffset={insets.top}
    >
      <View
        className="flex-row items-center gap-3 px-gutter pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <View className="flex-1">
          <Text variant="heading" numberOfLines={1}>
            {data?.deck.title ?? "Ask this deck"}
          </Text>
          <Text variant="caption">{CREDIT_COST.deck_chat} credit per question</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-gutter pb-4 gap-3"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View className="items-center px-6 pt-16">
            <Text variant="title" className="text-center">
              Ask anything about this deck
            </Text>
            <Text variant="body" className="mt-2 max-w-[290px] text-center text-ink-muted">
              Answers come from your own source material, so they will not wander off
              into things you never uploaded.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={item.role === "assistant" ? shadow.card : undefined}
            className={cn(
              "max-w-[85%] rounded-card px-4 py-3",
              item.role === "user"
                ? cn("self-end", deckClass[color].bg)
                : "self-start bg-surface",
            )}
          >
            <Text
              variant="body"
              className={item.role === "user" ? "text-ink-inverse" : "text-ink"}
            >
              {item.text}
            </Text>
          </View>
        )}
        ListFooterComponent={
          ask.isPending ? (
            <View style={shadow.card} className="max-w-[85%] gap-2 self-start rounded-card bg-surface px-4 py-3.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
            </View>
          ) : null
        }
      />

      <View
        className="flex-row items-end gap-2.5 px-gutter pt-2"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View
          style={shadow.card}
          className="max-h-[120px] flex-1 justify-center rounded-card bg-surface px-4 py-3"
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Ask a question"
            placeholderTextColor={raw.inkFaint}
            selectionColor={raw.clay}
            className="font-body text-body text-ink"
            onSubmitEditing={send}
          />
        </View>
        <IconButton
          icon={PaperPlaneRight}
          tone="ink"
          accessibilityLabel="Send question"
          disabled={!draft.trim() || ask.isPending}
          onPress={send}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
