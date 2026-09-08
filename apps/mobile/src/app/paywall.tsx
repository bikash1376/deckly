import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";
import { Check, X } from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOfferings, usePurchase, sortPackages } from "@/features/billing/purchases";
import { useMe } from "@/features/me/hooks";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";

const BENEFITS = [
  "600 credits every month",
  "Unlimited notes in the pad",
  "Handwriting and diagram scanning",
  "Ask any deck as much as you like",
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: me } = useMe();
  const { offering, loading, error: loadError } = useOfferings();
  const { buy, restore, busy, error: buyError } = usePurchase();

  const packages = offering ? sortPackages(offering.availablePackages) : [];
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    if (!selected && packages.length > 0) setSelected(packages[0]);
  }, [packages, selected]);

  const usedFree = (me?.entitlement.credits ?? 0) <= 0;

  return (
    <View className="flex-1 bg-bg">
      <View className="items-center pb-1 pt-3.5">
        <View className="h-1 w-9 rounded-pill bg-hairline" />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-6 pt-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-row gap-2">
            <View className="h-9 w-9 rounded-md bg-clay" />
            <View className="h-9 w-9 rounded-md bg-sage" />
            <View className="h-9 w-9 rounded-md bg-slate" />
            <View className="h-9 w-9 rounded-md bg-plum" />
          </View>
          <IconButton
            icon={X}
            tone="sunken"
            size="sm"
            accessibilityLabel="Close"
            onPress={() => router.back()}
          />
        </View>

        <Text variant="display" className="mt-5">
          {usedFree ? "You have used\nyour free credits." : "More room\nto study."}
        </Text>
        <Text variant="bodyLarge" className="mt-3 text-ink-muted">
          Reviewing stays free forever. Premium is for making new material.
        </Text>

        <View className="mt-6 gap-2.5">
          {loading ? (
            <>
              <Skeleton className="h-[84px] rounded-card" />
              <Skeleton className="h-[84px] rounded-card" />
            </>
          ) : packages.length === 0 ? (
            <View className="rounded-card border-[1.5px] border-hairline bg-surface p-4">
              <Text variant="body" className="text-ink-muted">
                {loadError ?? "No plans are available right now."}
              </Text>
            </View>
          ) : (
            packages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              const isAnnual = pkg.packageType === "ANNUAL";
              return (
                <Pressable
                  key={pkg.identifier}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${isAnnual ? "Yearly" : "Monthly"}, ${pkg.product.priceString}`}
                  onPress={() => setSelected(pkg)}
                  className={cn(
                    "rounded-card bg-surface p-4",
                    isSelected ? "border-2 border-ink" : "border-[1.5px] border-hairline",
                  )}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text variant="heading">{isAnnual ? "Yearly" : "Monthly"}</Text>
                        {isAnnual ? <Chip label="Best value" tone="amber" /> : null}
                      </View>
                      <Text variant="caption" className="mt-0.5">
                        {isAnnual ? "Billed once a year" : "Cancel any time"}
                      </Text>
                    </View>
                    <Text variant="heading">{pkg.product.priceString}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View className="mt-6 gap-2.5">
          {BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-2.5">
              <Check size={18} color={raw.success} weight="bold" />
              <Text variant="body" className="flex-1">
                {benefit}
              </Text>
            </View>
          ))}
        </View>

        {buyError ? (
          <Text variant="caption" className="mt-4 text-danger">
            {buyError}
          </Text>
        ) : null}
      </ScrollView>

      <View className="px-gutter" style={{ paddingBottom: insets.bottom + 20 }}>
        <Button
          label={selected?.packageType === "ANNUAL" ? "Start yearly" : "Start monthly"}
          loading={busy}
          disabled={!selected}
          onPress={async () => {
            if (!selected) return;
            const ok = await buy(selected);
            if (ok) router.back();
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore a previous purchase"
          onPress={async () => {
            const ok = await restore();
            if (ok) router.back();
          }}
          className="mt-3"
        >
          <Text variant="caption" className="text-center">
            Billed through Google Play. Restore purchase
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
