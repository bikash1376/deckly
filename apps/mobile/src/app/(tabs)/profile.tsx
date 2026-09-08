import { useCallback, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { CaretRight, Fire, Sparkle } from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card, PressableCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useDeleteAccount } from "@/features/me/hooks";
import { useConfirm } from "@/components/ui/confirm";
import { raw } from "@/theme";

const PRIVACY_URL = "https://retenit.app/privacy";
const TERMS_URL = "https://retenit.app/terms";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();

  const { data: me, isLoading } = useMe();
  const deleteAccount = useDeleteAccount();
  const ask = useConfirm();
  const [busy, setBusy] = useState(false);

  const confirmDelete = useCallback(async () => {
    const ok = await ask({
      title: "Delete your account?",
      body: "This removes your decks, notes and review history for good. It cannot be undone.",
      confirmLabel: "Delete everything",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await deleteAccount.mutateAsync();
      await signOut();
      router.replace("/(auth)/sign-in");
    } catch {
      await ask({
        title: "Could not delete your account",
        body: "Check your connection and try again. If it keeps failing, email help@retenit.app.",
        confirmLabel: "Close",
        cancelLabel: "Dismiss",
      });
    } finally {
      setBusy(false);
    }
  }, [ask, deleteAccount, signOut, router]);

  const isPremium = me?.entitlement.isPremium ?? false;
  const credits = me?.entitlement.credits ?? 0;
  const allowance = me?.entitlement.monthlyAllowance ?? 0;

  return (
    <ScrollView
      contentContainerClassName="px-gutter"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 120,
      }}
    >
      <Text variant="display">You</Text>

      <Card className="mt-5 p-4">
        <Text variant="heading" numberOfLines={1}>
          {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Signed in"}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {user?.primaryEmailAddress?.emailAddress ?? ""}
        </Text>
      </Card>

      {isLoading ? (
        <Skeleton className="mt-2.5 h-[120px] rounded-card" />
      ) : (
        <Card className="mt-2.5 p-4">
          <View className="flex-row items-center justify-between">
            <Text variant="overline">Credits</Text>
            <Chip
              label={isPremium ? "Premium" : "Free plan"}
              tone={isPremium ? "amber" : "neutral"}
            />
          </View>

          <Text variant="hero" className="mt-2">
            {credits}
          </Text>
          <Progress
            value={allowance > 0 ? credits / allowance : 0}
            tone="clay"
            className="mt-3"
          />
          <Text variant="caption" className="mt-2">
            {allowance > 0
              ? `of ${allowance} this month. Reviewing is always free.`
              : "Reviewing is always free."}
          </Text>

          {!isPremium ? (
            <Button
              label="Get more credits"
              icon={Sparkle}
              size="md"
              className="mt-4"
              onPress={() => router.push("/paywall")}
            />
          ) : null}
        </Card>
      )}

      <View className="mt-2.5 flex-row gap-2.5">
        <Card className="flex-1 p-4">
          <View className="flex-row items-center gap-1.5">
            <Fire size={16} color={raw.amber} weight="fill" />
            <Text variant="overline">Streak</Text>
          </View>
          <Text variant="title" className="mt-1.5">
            {me?.streak ?? 0}
          </Text>
          <Text variant="caption">{me?.streak === 1 ? "day" : "days"}</Text>
        </Card>
        <Card className="flex-1 p-4">
          <Text variant="overline">Reviewed</Text>
          <Text variant="title" className="mt-1.5">
            {me?.cardsReviewed ?? 0}
          </Text>
          <Text variant="caption">cards</Text>
        </Card>
      </View>

      <Text variant="overline" className="mb-2.5 mt-7">
        Settings
      </Text>

      <Row label="Daily review reminder" onPress={() => router.push("/settings/reminders")} />
      <Row label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
      <Row label="Terms of service" onPress={() => Linking.openURL(TERMS_URL)} />

      <View className="mt-7 gap-2.5">
        <Button
          label="Sign out"
          variant="secondary"
          onPress={async () => {
            const ok = await ask({
              title: "Sign out?",
              body: "Your decks and notes stay on your account.",
              confirmLabel: "Sign out",
            });
            if (!ok) return;
            signOut();
            router.replace("/(auth)/sign-in");
          }}
        />
        {/* Play Store requires an in-app deletion path that actually deletes. */}
        <Button
          label="Delete account"
          variant="destructive"
          loading={busy}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableCard
      onPress={onPress}
      accessibilityLabel={label}
      className="mb-2 flex-row items-center justify-between p-4"
    >
      <Text variant="subheading">{label}</Text>
      <CaretRight size={18} color={raw.inkFaint} weight="regular" />
    </PressableCard>
  );
}
