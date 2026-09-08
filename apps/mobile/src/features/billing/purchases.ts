import { useCallback, useEffect, useState } from "react";
import Purchases, {
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";
import { env } from "@/lib/env";

/**
 * RevenueCat wiring.
 *
 * Entitlements are read from our own API, not from this SDK. RevenueCat's
 * customer info is the fastest way to know a purchase went through, but the
 * server only believes the webhook. That ordering matters: a client that can
 * assert its own entitlement is a client that can be patched to assert it for
 * free.
 */

let configured = false;

export function useConfigurePurchases() {
  const { userId, isSignedIn } = useAuth();

  useEffect(() => {
    if (!env.revenueCatKey || !isSignedIn || !userId) return;

    if (!configured) {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      Purchases.configure({ apiKey: env.revenueCatKey, appUserID: userId });
      configured = true;
    } else {
      // Same install, different account. Without this the purchase lands on
      // whichever user happened to sign in first.
      Purchases.logIn(userId).catch(() => {});
    }
  }, [userId, isSignedIn]);
}

export function useOfferings() {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!env.revenueCatKey) {
      setLoading(false);
      setError("Billing is not configured yet.");
      return;
    }

    let cancelled = false;
    Purchases.getOfferings()
      .then((offerings) => {
        if (cancelled) return;
        setOffering(offerings.current);
        if (!offerings.current) {
          setError("No plans are available right now. Try again shortly.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load plans. Check your connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { offering, loading, error };
}

export function usePurchase() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await Purchases.purchasePackage(pkg);
        // The webhook is what actually grants the entitlement, and it lands in
        // well under a second. Refetching `me` picks it up.
        await qc.invalidateQueries({ queryKey: ["me"] });
        return true;
      } catch (caught) {
        const cancelled = (caught as { userCancelled?: boolean })?.userCancelled;
        if (!cancelled) {
          setError("The purchase did not go through. You have not been charged.");
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [qc],
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await Purchases.restorePurchases();
      await qc.invalidateQueries({ queryKey: ["me"] });
      return true;
    } catch {
      setError("Could not restore. Make sure you are signed in to the right Google account.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [qc]);

  return { buy, restore, busy, error };
}

/** Annual over monthly, because annual is most of the revenue. */
export function sortPackages(packages: PurchasesPackage[]): PurchasesPackage[] {
  const rank = (p: PurchasesPackage) =>
    p.packageType === "ANNUAL" ? 0 : p.packageType === "MONTHLY" ? 1 : 2;
  return [...packages].sort((a, b) => rank(a) - rank(b));
}
