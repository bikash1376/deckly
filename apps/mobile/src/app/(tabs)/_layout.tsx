import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { View } from "react-native";

import { TabBar } from "@/components/tab-bar";
import { useDueCount } from "@/features/review/hooks";
import { useConfigurePurchases } from "@/features/billing/purchases";

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { data: dueCount = 0 } = useDueCount();

  // Identify the RevenueCat user with the Clerk id, so a purchase lands on the
  // right account rather than on whoever signed in first on this install.
  useConfigurePurchases();

  // Hold on a plain ground rather than a spinner. Clerk resolves from the
  // keystore in a few frames, and a spinner that flashes for 80ms is worse
  // than nothing.
  if (!isLoaded) return <View className="flex-1 bg-bg" />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      tabBar={(props) => <TabBar {...props} dueCount={dueCount} />}
    >
      <Tabs.Screen name="index" options={{ title: "Decks" }} />
      <Tabs.Screen name="pad" options={{ title: "Pad" }} />
      <Tabs.Screen name="review" options={{ title: "Review" }} />
      <Tabs.Screen name="profile" options={{ title: "You" }} />
    </Tabs>
  );
}
