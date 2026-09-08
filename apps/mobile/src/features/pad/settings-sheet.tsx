import { Pressable, Switch, View } from "react-native";
import {
  CardsIcon as Cards,
} from "phosphor-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Sheet, SheetRow, SheetScrollView } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";
import {
  useTypography,
  FONT_FAMILIES,
  FONT_SIZES,
  LINE_HEIGHTS,
  TRACKING,
} from "./typography";
import { isGrammarConfigured } from "./grammar";

/**
 * Reading and writing preferences for the pad.
 *
 * Every control here is a small set of named choices rather than a slider.
 * Sliders invite fiddling and land people on 16.4pt with awkward leading; five
 * checked sizes covers everyone and every one of them looks right.
 */
export function PadSettingsSheet({
  visible,
  onClose,
  onMakeDeck,
  canMakeDeck = false,
  makingDeck = false,
}: {
  visible: boolean;
  onClose: () => void;
  /** Turn this note into a deck. Absent on a note too short to be worth it. */
  onMakeDeck?: () => void;
  canMakeDeck?: boolean;
  makingDeck?: boolean;
}) {
  const t = useTypography();
  const grammarAvailable = isGrammarConfigured();

  return (
    <Sheet visible={visible} onClose={onClose} title="Writing">
      {/* Sheet aware: scrolls while there is content left, then hands the
          gesture back to the sheet so a pull at the top still dismisses it. */}
      <SheetScrollView>
        <SheetRow label="Typeface">
          <View className="gap-2">
            {FONT_FAMILIES.map((family) => {
              const active = t.family === family.id;
              return (
                <Pressable
                  key={family.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${family.label}, ${family.note}`}
                  onPress={() => t.setFamily(family.id)}
                  className={cn(
                    "flex-row items-center justify-between rounded-tile border-[1.5px] px-4 py-3",
                    active ? "border-ink bg-surface" : "border-hairline bg-surface",
                  )}
                >
                  <View className="flex-1">
                    {/* Set in the face itself, so the list is its own specimen. */}
                    <Text
                      variant="subheading"
                      style={{ fontFamily: family.regular }}
                      className="text-ink"
                    >
                      {family.label}
                    </Text>
                    <Text variant="caption">{family.note}</Text>
                  </View>
                  <View
                    className={cn(
                      "h-5 w-5 rounded-pill border-[1.5px]",
                      active ? "border-ink bg-ink" : "border-hairline",
                    )}
                  />
                </Pressable>
              );
            })}
          </View>
        </SheetRow>

        <SheetRow label="Size">
          <View className="flex-row gap-2">
            {FONT_SIZES.map((size) => (
              <Pressable
                key={size}
                accessibilityRole="radio"
                accessibilityState={{ selected: t.size === size }}
                accessibilityLabel={`${size} point`}
                onPress={() => t.setSize(size)}
                className={cn(
                  "flex-1 items-center justify-center rounded-tile border-[1.5px] py-3",
                  t.size === size ? "border-ink bg-surface" : "border-hairline bg-surface",
                )}
              >
                <Text style={{ fontSize: size }} className="text-ink">
                  Aa
                </Text>
              </Pressable>
            ))}
          </View>
        </SheetRow>

        <SheetRow label="Weight">
          <Choices
            options={[
              { id: "regular", label: "Regular" },
              { id: "bold", label: "Bold" },
            ]}
            value={t.bold ? "bold" : "regular"}
            onChange={(id) => t.setBold(id === "bold")}
          />
        </SheetRow>

        <SheetRow label="Line height">
          <Choices
            options={LINE_HEIGHTS.map((l) => ({ id: l.id, label: l.label }))}
            value={t.lineHeight}
            onChange={(id) => t.setLineHeight(id as typeof t.lineHeight)}
          />
        </SheetRow>

        <SheetRow label="Letter spacing">
          <Choices
            options={TRACKING.map((tr) => ({ id: tr.id, label: tr.label }))}
            value={t.tracking}
            onChange={(id) => t.setTracking(id as typeof t.tracking)}
          />
        </SheetRow>

        <SheetRow
          label="Check my writing"
          hint={
            grammarAvailable
              ? "Underlines spelling and grammar. Tap one to see the fix."
              : "Underlines spelling, checked on your device with nothing sent anywhere. Tap one to see the fix."
          }
        >
          <View className="flex-row items-center justify-between rounded-tile border-[1.5px] border-hairline bg-surface px-4 py-3">
            <Text variant="subheading">Underline mistakes</Text>
            <Switch
              value={t.grammarEnabled}
              onValueChange={t.setGrammarEnabled}
              trackColor={{ true: raw.ink, false: raw.hairline }}
              thumbColor="#FFFFFF"
            />
          </View>
        </SheetRow>

        {onMakeDeck ? (
          <SheetRow
            label="This note"
            hint={
              canMakeDeck
                ? "Makes flashcards and a quiz from what you have written."
                : "Write a little more and you can turn this into a deck."
            }
          >
            <Button
              label={makingDeck ? "Making a deck" : "Turn into a deck"}
              variant="secondary"
              size="md"
              icon={Cards}
              disabled={!canMakeDeck || makingDeck}
              onPress={() => {
                onClose();
                onMakeDeck();
              }}
            />
          </SheetRow>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset writing settings"
          onPress={t.reset}
          className="items-center py-2"
        >
          <Text variant="caption" className="text-ink-muted">
            Reset to default
          </Text>
        </Pressable>
      </SheetScrollView>
    </Sheet>
  );
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.id)}
            className={cn(
              "flex-1 items-center justify-center rounded-tile border-[1.5px] py-3",
              active ? "border-ink bg-surface" : "border-hairline bg-surface",
            )}
          >
            <Text variant="label" className={active ? "text-ink" : "text-ink-muted"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
