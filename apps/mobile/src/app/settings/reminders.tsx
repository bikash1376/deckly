import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeftIcon as ArrowLeft,
  CheckIcon as Check,
} from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  getScheduledReminder,
  requestPermission,
} from "@/features/review/notifications";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";

/**
 * Fixed slots rather than a time picker. Three choices someone will actually
 * pick beat a wheel that makes them think about it.
 */
const SLOTS = [
  { hour: 8, minute: 30, label: "Morning", detail: "8:30 am, before the day starts" },
  { hour: 17, minute: 0, label: "After class", detail: "5:00 pm, while it is fresh" },
  { hour: 20, minute: 30, label: "Evening", detail: "8:30 pm, wind down with a few cards" },
];

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [active, setActive] = useState<{ hour: number; minute: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScheduledReminder().then(setActive).catch(() => {});
  }, []);

  const choose = useCallback(async (hour: number, minute: number) => {
    setBusy(true);
    setError(null);
    try {
      const granted = await requestPermission();
      if (!granted) {
        setError(
          "Notifications are off for Retenit. Turn them on in Android settings to get reminders.",
        );
        return;
      }
      await scheduleDailyReminder(hour, minute);
      setActive({ hour, minute });
    } catch {
      setError("Could not set that reminder. Try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const turnOff = useCallback(async () => {
    setBusy(true);
    await cancelDailyReminder();
    setActive(null);
    setBusy(false);
  }, []);

  return (
    <ScrollView
      contentContainerClassName="px-gutter pb-10"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />

      <Text variant="display" className="mt-4">
        Daily reminder
      </Text>
      <Text variant="bodyLarge" className="mt-2 text-ink-muted">
        One notification a day, telling you how many cards are waiting. Nothing else.
      </Text>

      <View className="mt-6 gap-2.5">
        {SLOTS.map((slot) => {
          const selected = active?.hour === slot.hour && active?.minute === slot.minute;
          return (
            <Pressable
              key={slot.label}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: busy }}
              accessibilityLabel={`${slot.label}. ${slot.detail}`}
              disabled={busy}
              onPress={() => choose(slot.hour, slot.minute)}
            >
              <Card
                tone={selected ? "elevated" : "outlined"}
                className={cn("flex-row items-center justify-between p-4", selected && "border-2 border-ink")}
              >
                <View className="flex-1">
                  <Text variant="heading">{slot.label}</Text>
                  <Text variant="caption">{slot.detail}</Text>
                </View>
                {selected ? <Check size={20} color={raw.success} weight="bold" /> : null}
              </Card>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text variant="caption" className="mt-4 text-danger">
          {error}
        </Text>
      ) : null}

      {active ? (
        <Button
          label="Turn reminders off"
          variant="secondary"
          className="mt-6"
          loading={busy}
          onPress={turnOff}
        />
      ) : null}
    </ScrollView>
  );
}
