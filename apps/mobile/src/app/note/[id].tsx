import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ArrowLeft, Sparkle, TextAa, Cards as CardsIcon, X } from "phosphor-react-native";
import { CREDIT_COST, type GrammarCheck, type EnhanceResult } from "@deckly/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import {
  useNote,
  useCreateNote,
  useSaveNote,
  useGrammarCheck,
  useEnhance,
  useNoteToDeck,
} from "@/features/notes/hooks";
import { ApiError } from "@/lib/api";
import { raw, shadow } from "@/theme";

const AUTOSAVE_MS = 1200;

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isNew = id === "new";
  const { data: note } = useNote(id);

  const [noteId, setNoteId] = useState(isNew ? null : id);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [saved, setSaved] = useState<string | null>(null);

  const [issues, setIssues] = useState<GrammarCheck["issues"]>([]);
  const [issueIndex, setIssueIndex] = useState(0);
  const [options, setOptions] = useState<EnhanceResult["options"] | null>(null);

  const createNote = useCreateNote();
  const saveNote = useSaveNote(noteId ?? "");
  const grammar = useGrammarCheck();
  const enhance = useEnhance();
  const toDeck = useNoteToDeck();

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // Load once. Re-syncing from the server on every refetch would yank the
  // cursor out from under someone mid-sentence.
  useEffect(() => {
    if (note && !hydrated.current) {
      setTitle(note.title);
      setBody(note.body);
      hydrated.current = true;
    }
  }, [note]);

  const persist = useCallback(
    async (nextTitle: string, nextBody: string) => {
      try {
        if (!noteId) {
          if (!nextTitle.trim() && !nextBody.trim()) return;
          const created = await createNote.mutateAsync({ title: nextTitle, body: nextBody });
          setNoteId(created.id);
        } else {
          await saveNote.mutateAsync({ title: nextTitle, body: nextBody });
        }
        setSaved("Saved just now");
      } catch (caught) {
        if (caught instanceof ApiError && caught.isOutOfCredits) {
          router.push("/paywall");
          return;
        }
        setSaved("Not saved. Check your connection.");
      }
    },
    [noteId, createNote, saveNote, router],
  );

  const scheduleSave = useCallback(
    (nextTitle: string, nextBody: string) => {
      setSaved(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(nextTitle, nextBody), AUTOSAVE_MS);
    },
    [persist],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const selected = useMemo(
    () => body.slice(selection.start, selection.end).trim(),
    [body, selection],
  );
  const hasSelection = selected.length > 8;

  const runGrammar = useCallback(async () => {
    const target = hasSelection ? selected : body;
    if (target.trim().length < 8) return;
    try {
      const result = await grammar.mutateAsync({ text: target });
      setIssues(result.issues);
      setIssueIndex(0);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isOutOfCredits) router.push("/paywall");
    }
  }, [hasSelection, selected, body, grammar, router]);

  const runEnhance = useCallback(async () => {
    if (!hasSelection) return;
    try {
      const result = await enhance.mutateAsync({ text: selected });
      setOptions(result.options);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isOutOfCredits) router.push("/paywall");
    }
  }, [hasSelection, selected, enhance, router]);

  const applyIssue = useCallback(() => {
    const issue = issues[issueIndex];
    if (!issue) return;

    // Replace the first exact occurrence. The model is asked for a verbatim
    // substring precisely so this stays a plain string operation rather than a
    // fuzzy match that could rewrite the wrong sentence.
    const at = body.indexOf(issue.original);
    if (at >= 0) {
      const next = body.slice(0, at) + issue.suggestion + body.slice(at + issue.original.length);
      setBody(next);
      scheduleSave(title, next);
    }
    advanceIssue();
  }, [issues, issueIndex, body, title, scheduleSave]);

  const advanceIssue = useCallback(() => {
    setIssueIndex((i) => {
      const next = i + 1;
      if (next >= issues.length) setIssues([]);
      return next;
    });
  }, [issues.length]);

  const applyOption = useCallback(
    (text: string) => {
      const next = body.slice(0, selection.start) + text + body.slice(selection.end);
      setBody(next);
      setOptions(null);
      scheduleSave(title, next);
    },
    [body, selection, title, scheduleSave],
  );

  const makeDeck = useCallback(async () => {
    if (!noteId) return;
    try {
      const deck = await toDeck.mutateAsync(noteId);
      router.push(`/deck/${deck.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.isOutOfCredits) router.push("/paywall");
    }
  }, [noteId, toDeck, router]);

  const issue = issues[issueIndex];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <View
        className="flex-row items-center justify-between px-gutter pb-2"
        style={{ paddingTop: insets.top + 12 }}
      >
        <IconButton
          icon={ArrowLeft}
          tone="bare"
          accessibilityLabel="Back"
          onPress={() => {
            if (timer.current) clearTimeout(timer.current);
            persist(title, body);
            router.back();
          }}
        />
        <Text variant="caption">
          {saved ?? (createNote.isPending || saveNote.isPending ? "Saving" : "Not saved yet")}
        </Text>
        <IconButton
          icon={CardsIcon}
          tone="bare"
          accessibilityLabel="Turn this note into a deck"
          disabled={!noteId || toDeck.isPending || body.trim().length < 40}
          onPress={makeDeck}
        />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-40 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          value={title}
          onChangeText={(next) => {
            setTitle(next);
            scheduleSave(next, body);
          }}
          placeholder="Untitled note"
          placeholderTextColor={raw.inkFaint}
          selectionColor={raw.clay}
          className="font-display text-title text-ink"
        />

        <TextInput
          value={body}
          onChangeText={(next) => {
            setBody(next);
            scheduleSave(title, next);
          }}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          multiline
          autoFocus={isNew}
          placeholder="Start writing. Select a passage to check it or ask for a cleaner version."
          placeholderTextColor={raw.inkFaint}
          selectionColor={raw.clay}
          textAlignVertical="top"
          className="mt-4 min-h-[320px] font-body text-body-lg text-ink"
        />
      </ScrollView>

      {/* Selection toolbar. Appears only when there is enough text to act on,
          so it does not flicker on every cursor move. */}
      {hasSelection && !issue && !options ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          className="absolute inset-x-gutter"
          style={{ bottom: insets.bottom + 24 }}
        >
          <View
            style={shadow.floating}
            className="flex-row items-center gap-2 rounded-pill bg-surface p-2"
          >
            <Chip
              label={`Grammar, ${CREDIT_COST.grammar}`}
              tone="outline"
              icon={TextAa}
              onPress={runGrammar}
            />
            <Chip
              label={`Enhance, ${CREDIT_COST.enhance}`}
              tone="outline"
              icon={Sparkle}
              onPress={runEnhance}
            />
            {grammar.isPending || enhance.isPending ? (
              <Text variant="caption" className="ml-1">
                Working
              </Text>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {issue ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          className="absolute inset-x-gutter"
          style={{ bottom: insets.bottom + 24 }}
        >
          <Card className="p-4">
            <View className="mb-2.5 flex-row items-center justify-between">
              <Text variant="overline" className="text-danger">
                {issue.kind}
              </Text>
              <Text variant="caption">
                {issueIndex + 1} of {issues.length}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Text variant="body" className="text-ink-faint line-through">
                {issue.original}
              </Text>
              <Text variant="subheading" className="font-body-sb">
                {issue.suggestion}
              </Text>
            </View>
            <Text variant="caption" className="mt-0.5">
              {issue.note}
            </Text>

            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <Button label="Fix" size="md" onPress={applyIssue} />
              </View>
              <View className="flex-1">
                <Button label="Ignore" size="md" variant="secondary" onPress={advanceIssue} />
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {options ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          className="absolute inset-x-gutter"
          style={{ bottom: insets.bottom + 24 }}
        >
          <Card className="p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text variant="overline">Pick a version</Text>
              <IconButton
                icon={X}
                tone="bare"
                size="sm"
                accessibilityLabel="Dismiss"
                onPress={() => setOptions(null)}
              />
            </View>

            <View className="gap-2.5">
              {options.map((option) => (
                <View key={option.label} className="gap-1.5">
                  <Chip label={option.label} tone="neutral" />
                  <Text variant="body">{option.text}</Text>
                  <Button
                    label="Use this"
                    size="md"
                    variant="secondary"
                    onPress={() => applyOption(option.text)}
                  />
                </View>
              ))}
            </View>

            <Text variant="caption" className="mt-3">
              Your original is untouched until you pick one.
            </Text>
          </Card>
        </Animated.View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
