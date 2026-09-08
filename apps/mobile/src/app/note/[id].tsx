import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  ArrowLeftIcon as ArrowLeft,
  TextAaIcon as TextAa,
  MagnifyingGlassIcon as MagnifyingGlass,
  XIcon as X,
} from "phosphor-react-native";
import type { GrammarIssue } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import {
  useNote,
  useCreateNote,
  useSaveNote,
  useNoteToDeck,
} from "@/features/notes/hooks";
import { PadSettingsSheet } from "@/features/pad/settings-sheet";
import { LookupSheet } from "@/features/pad/lookup-sheet";
import { useTypography, resolveTextStyle } from "@/features/pad/typography";
import { usePadFonts } from "@/features/pad/fonts";
import { useGrammar, segment, applyReplacement } from "@/features/pad/grammar";
import { ApiError } from "@/lib/api";
import { raw } from "@/theme";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [lookupQuery, setLookupQuery] = useState<string | null>(null);
  const [activeIssue, setActiveIssue] = useState<GrammarIssue | null>(null);

  const createNote = useCreateNote();
  const saveNote = useSaveNote(noteId ?? "");
  const toDeck = useNoteToDeck();

  const typography = useTypography();
  // Loads in the background. Until it resolves the editor renders in the system
  // face, which is a better first frame than a blank screen.
  const padFontsReady = usePadFonts();
  const textStyle = useMemo(
    () => (padFontsReady ? resolveTextStyle(typography) : { fontSize: typography.size }),
    [typography, padFontsReady],
  );
  const { issues, checking } = useGrammar(body, typography.grammarEnabled);

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
      } catch (caught) {
        if (caught instanceof ApiError && caught.isOutOfCredits) {
          router.push("/paywall");
        }
        // Otherwise stay quiet. The next keystroke schedules another attempt,
        // and a banner about a failed save helps nobody mid-sentence.
      }
    },
    [noteId, createNote, saveNote, router],
  );

  const scheduleSave = useCallback(
    (nextTitle: string, nextBody: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(nextTitle, nextBody), AUTOSAVE_MS);
    },
    [persist],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const changeBody = useCallback(
    (next: string) => {
      setBody(next);
      setActiveIssue(null);
      scheduleSave(title, next);
    },
    [title, scheduleSave],
  );

  const fixIssue = useCallback(
    (issue: GrammarIssue, replacement: string) => {
      changeBody(applyReplacement(body, issue, replacement));
    },
    [body, changeBody],
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

  const selected = body.slice(selection.start, selection.end).trim();
  const hasSelection = selected.length > 1;

  /**
   * Look up the selection.
   *
   * Opens the ordinary Google results page in a sheet over the note, so the
   * answer arrives without losing the cursor or leaving the app. Nothing is
   * reformatted: it is the page Google serves, in a WebView.
   */
  const lookUp = useCallback(() => {
    if (!hasSelection) return;
    setLookupQuery(selected.slice(0, 200));
  }, [hasSelection, selected]);

  const showSegments = typography.grammarEnabled && issues.length > 0;
  const segments = useMemo(
    () => (showSegments ? segment(body, issues) : []),
    [showSegments, body, issues],
  );

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
        <View className="flex-row">
          {/* Enabled by a selection. Looking a word up is the one thing people
              leave a writing app for, so it belongs in the app. */}
          <IconButton
            icon={MagnifyingGlass}
            tone="bare"
            accessibilityLabel="Look up the selected text"
            disabled={!hasSelection}
            onPress={lookUp}
          />
          <IconButton
            icon={TextAa}
            tone="bare"
            accessibilityLabel="Writing settings"
            onPress={() => setSettingsOpen(true)}
          />
        </View>
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

        {/*
          Two rendering paths on purpose.

          With grammar off, or with nothing flagged, this is a plain controlled
          TextInput: the simplest thing, and the one least likely to fight the
          Android keyboard over cursor position.

          With issues present it renders styled child Text runs instead, which
          is React Native's supported way to mark up ranges inside an input, so
          the underline sits under exactly the offending characters rather than
          under a guess found by searching for the word.

          Android ignores textDecorationStyle, so there is no true wavy line
          available. A danger coloured underline plus a faint tint reads the
          same and, unlike a squiggle, is comfortably tappable.
        */}
        <TextInput
          multiline
          autoFocus={isNew}
          onChangeText={changeBody}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          placeholder="Start writing."
          placeholderTextColor={raw.inkFaint}
          selectionColor={raw.clay}
          textAlignVertical="top"
          // Android's own keyboard does the spelling squiggles, on device and
          // free. This only has to add the grammar half.
          autoCorrect
          spellCheck
          style={textStyle}
          className="mt-4 min-h-[320px] text-ink"
          {...(showSegments ? {} : { value: body })}
        >
          {showSegments
            ? segments.map((part, i) =>
                part.issue ? (
                  <Text
                    key={i}
                    raw
                    onPress={() => setActiveIssue(part.issue)}
                    style={[
                      textStyle,
                      {
                        textDecorationLine: "underline",
                        textDecorationColor: raw.danger,
                        backgroundColor: "#F5E6E3",
                      },
                    ]}
                  >
                    {part.text}
                  </Text>
                ) : (
                  <Text key={i} raw style={textStyle}>
                    {part.text}
                  </Text>
                ),
              )
            : null}
        </TextInput>
      </ScrollView>

      {typography.grammarEnabled && issues.length > 0 && !activeIssue ? (
        <View
          className="absolute inset-x-gutter"
          style={{ bottom: insets.bottom + 24 }}
          pointerEvents="none"
        >
          <Chip
            label={issues.length === 1 ? "1 thing to look at" : `${issues.length} things to look at`}
            tone="danger"
            className="self-center"
          />
        </View>
      ) : null}

      {activeIssue ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          className="absolute inset-x-gutter"
          style={{ bottom: insets.bottom + 24 }}
        >
          <Card className="p-4">
            <View className="mb-2 flex-row items-start justify-between gap-3">
              <Text variant="overline" className="text-danger">
                {activeIssue.category}
              </Text>
              <IconButton
                icon={X}
                tone="bare"
                size="sm"
                accessibilityLabel="Dismiss"
                onPress={() => setActiveIssue(null)}
              />
            </View>

            <Text variant="body">{activeIssue.shortMessage || activeIssue.message}</Text>

            {activeIssue.replacements.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {activeIssue.replacements.map((replacement) => (
                  <Chip
                    key={replacement}
                    label={replacement}
                    tone="outline"
                    onPress={() => {
                      fixIssue(activeIssue, replacement);
                      setActiveIssue(null);
                    }}
                  />
                ))}
              </View>
            ) : (
              <Text variant="caption" className="mt-2">
                No suggested fix for this one.
              </Text>
            )}

            <Button
              label="Leave it"
              variant="secondary"
              size="md"
              className="mt-3"
              onPress={() => setActiveIssue(null)}
            />
          </Card>
        </Animated.View>
      ) : null}

      {lookupQuery ? (
        <LookupSheet query={lookupQuery} onClose={() => setLookupQuery(null)} />
      ) : null}

      <PadSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onMakeDeck={makeDeck}
        canMakeDeck={!!noteId && body.trim().length >= 40}
        makingDeck={toDeck.isPending}
      />
    </KeyboardAvoidingView>
  );
}
