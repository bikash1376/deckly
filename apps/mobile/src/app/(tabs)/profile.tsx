import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { DotsThree, Fire, Sparkle } from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/me/hooks";
import { raw } from "@/theme";

/**
 * What someone actually opens this tab for: who they are signed in as, how many
 * credits are left, and whether the streak is alive.
 *
 * The legal links and the destructive account actions moved behind the menu.
 * Those are visited once or never, and sitting them in the same list as the
 * numbers made the numbers harder to find.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { data: me, isLoading } = useMe();

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
      <View className="flex-row items-center justify-between">
        <Text variant="display">You</Text>
        <IconButton
          icon={DotsThree}
          accessibilityLabel="Settings and account"
          onPress={() => router.push("/settings/menu")}
        />
      </View>

      <Card className="mt-5 p-4">
        <Text variant="heading" numberOfLines={1}>
          {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Signed in"}
        </Text>
        <Text variant="caption" numberOfLines={1}>
          {user?.primaryEmailAddress?.emailAddress ?? ""}
        </Text>
      </Card>

      {isLoading ? (
        <Skeleton className="mt-2.5 h-[170px] rounded-card" />
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
              ? `of ${allowance} this month. Reviewing and writing your own cards are always free.`
              : "Reviewing and writing your own cards are always free."}
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
    </ScrollView>
  );
}
