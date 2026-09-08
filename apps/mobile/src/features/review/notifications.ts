import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * The daily review reminder.
 *
 * This is the single highest leverage retention mechanic in the app, and it is
 * also the fastest way to get uninstalled. So: one notification a day, at a
 * time the user picks, and it says how many cards are waiting rather than
 * nagging. No streak guilt, no "we miss you".
 */

const CHANNEL_ID = "daily-review";
const IDENTIFIER = "daily-review-reminder";

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily review",
    importance: Notifications.AndroidImportance.DEFAULT,
    // No vibration or sound. A study reminder is not an emergency.
    vibrationPattern: [0],
    lightColor: "#935B5D",
  });
}

export async function requestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  // Android 13+ needs an explicit runtime grant, and asking at the wrong moment
  // is how you get a permanent denial. Call this from the reminder settings
  // screen, never on first launch.
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await ensureChannel();
  await cancelDailyReminder();

  await Notifications.scheduleNotificationAsync({
    identifier: IDENTIFIER,
    content: {
      title: "Cards are due",
      body: "A few minutes now beats an hour the night before.",
      // The badge count is set by the server push when there is a real number.
      // A locally scheduled notification cannot know it.
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(IDENTIFIER).catch(() => {
    // Nothing scheduled. Cancelling something that does not exist is fine.
  });
}

export async function getScheduledReminder(): Promise<{ hour: number; minute: number } | null> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const found = scheduled.find((n) => n.identifier === IDENTIFIER);
  if (!found) return null;

  const trigger = found.trigger as { hour?: number; minute?: number } | null;
  if (typeof trigger?.hour !== "number" || typeof trigger?.minute !== "number") return null;

  return { hour: trigger.hour, minute: trigger.minute };
}
