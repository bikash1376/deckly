import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { NotePencil, Plus, Lock } from "phosphor-react-native";
import type { Note } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { PressableCard } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useNotes } from "@/features/notes/hooks";
import { useMe } from "@/features/me/hooks";
import { raw } from "@/theme";

export default function PadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: notes, isLoading, refetch, isRefetching } = useNotes();
  const { data: me } = useMe();

  const limit = me?.entitlement.noteLimit ?? 2;
  const used = notes?.length ?? 0;
  const atLimit = !me?.entitlement.isPremium && used >= limit;

  const compose = () => (atLimit ? router.push("/paywall") : router.push("/note/new"));

  const header = (
    <View className="mb-1">
      <Text variant="display">Pad</Text>
      <Text variant="caption" className="mt-1">
        {me?.entitlement.isPremium
          ? "Write anything. Grammar and rewrites are a tap away."
          : `${used} of ${limit} notes used on the free plan`}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 8 }}>
        {header}
        <View className="mt-5 gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[86px] rounded-card" />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        data={notes ?? []}
        keyExtractor={(item: Note) => item.id}
        contentContainerClassName="px-gutter gap-2.5"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={header}
        ListHeaderComponentClassName="mb-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={raw.inkMuted} />
        }
        renderItem={({ item }) => (
          <PressableCard
            onPress={() => router.push(`/note/${item.id}`)}
            accessibilityLabel={item.title || "Untitled note"}
            className="p-4"
          >
            <Text variant="heading" numberOfLines={1}>
              {item.title || "Untitled note"}
            </Text>
            <Text variant="body" className="mt-1 text-ink-muted" numberOfLines={2}>
              {item.body || "Empty"}
            </Text>
            <Text variant="caption" className="mt-2 text-ink-faint">
              {relativeTime(item.updatedAt)}
            </Text>
          </PressableCard>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={NotePencil}
            title="Start writing"
            body="Essay plans, lecture notes, anything. Select a passage to check grammar or ask for a cleaner version."
            actionLabel="New note"
            onAction={compose}
          />
        }
      />

      <View
        className="absolute right-gutter"
        style={{ bottom: insets.bottom + 96 }}
        pointerEvents="box-none"
      >
        <IconButton
          icon={atLimit ? Lock : Plus}
          tone="ink"
          size="lg"
          accessibilityLabel={atLimit ? "Upgrade for more notes" : "New note"}
          onPress={compose}
        />
      </View>
    </View>
  );
}

/** Short and human. Anything past a week is a date, not a countdown. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;

  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
