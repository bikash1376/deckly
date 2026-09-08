import { useCallback, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import {
  ArrowLeftIcon as ArrowLeft,
  BellIcon as Bell,
  CaretRightIcon as CaretRight,
  InfoIcon as Info,
  ShieldCheckIcon as ShieldCheck,
  FileTextIcon as FileText,
  SignOutIcon as SignOut,
  TrashIcon as Trash,
} from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { PressableCard } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { useConfirm } from "@/components/ui/confirm";
import { useDeleteAccount } from "@/features/me/hooks";
import { raw } from "@/theme";

const PRIVACY_URL = "https://retenit.app/privacy";
const TERMS_URL = "https://retenit.app/terms";

/**
 * Everything you set once and then forget.
 *
 * Grouped so the two destructive actions sit apart from the reading material,
 * rather than a flat list where Delete account is one row below Terms of
 * service and the same size as it.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const ask = useConfirm();
  const deleteAccount = useDeleteAccount();
  const [busy, setBusy] = useState(false);

  const confirmSignOut = useCallback(async () => {
    const ok = await ask({
      title: "Sign out?",
      body: "Your decks and notes stay on your account.",
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    signOut();
    router.replace("/(auth)/sign-in");
  }, [ask, signOut, router]);

  const confirmDelete = useCallback(async () => {
    const ok = await ask({
      title: "Delete your account?",
      body: "Your decks, notes and review history go for good. This cannot be undone.",
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

  return (
    <ScrollView
      contentContainerClassName="px-gutter pb-12"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />

      <Text variant="display" className="mt-4">
        Settings
      </Text>

      <Text variant="overline" className="mb-2.5 mt-7">
        App
      </Text>
      <Row
        icon={Bell}
        label="Daily reminder"
        onPress={() => router.push("/settings/reminders")}
      />
      <Row icon={Info} label="About Retenit" onPress={() => router.push("/settings/about")} />

      <Text variant="overline" className="mb-2.5 mt-7">
        Legal
      </Text>
      <Row
        icon={ShieldCheck}
        label="Privacy policy"
        onPress={() => Linking.openURL(PRIVACY_URL)}
      />
      <Row icon={FileText} label="Terms of service" onPress={() => Linking.openURL(TERMS_URL)} />

      <Text variant="overline" className="mb-2.5 mt-7">
        Account
      </Text>
      <Row icon={SignOut} label="Sign out" onPress={confirmSignOut} />
      <Row
        icon={Trash}
        label={busy ? "Deleting" : "Delete account"}
        onPress={confirmDelete}
        destructive
        disabled={busy}
      />
    </ScrollView>
  );
}

function Row({
  icon: IconComponent,
  label,
  onPress,
  destructive = false,
  disabled = false,
}: {
  icon: typeof Bell;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableCard
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className="mb-2 flex-row items-center gap-3 p-4"
    >
      <IconComponent
        size={20}
        color={destructive ? raw.danger : raw.inkMuted}
        weight="regular"
      />
      <Text variant="subheading" className={destructive ? "flex-1 text-danger" : "flex-1"}>
        {label}
      </Text>
      <CaretRight size={18} color={raw.inkFaint} weight="regular" />
    </PressableCard>
  );
}
