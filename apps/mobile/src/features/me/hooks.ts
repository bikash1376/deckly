import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Me, CREDIT_COST } from "@deckly/shared";
import { useApi } from "@/lib/use-api";

export const meKeys = { all: ["me"] as const };

export function useMe() {
  const api = useApi();
  return useQuery({
    queryKey: meKeys.all,
    queryFn: ({ signal }) => api.get("/me", Me, signal),
  });
}

/**
 * Whether an action is affordable, for greying out a button before spending a
 * round trip on a refusal.
 *
 * This is a hint, never a gate. The server checks and debits atomically; a
 * client that thinks it has credits it does not will simply be told no.
 */
export function useCanAfford() {
  const { data } = useMe();
  const credits = data?.entitlement.credits ?? 0;

  return (action: keyof typeof CREDIT_COST | string) => {
    const cost = CREDIT_COST[action] ?? 0;
    return { affordable: credits >= cost, cost, credits };
  };
}

/**
 * Play Store requires an in-app deletion path, and it has to actually delete
 * rather than deactivate. The Worker removes the rows and the Clerk user.
 */
export function useDeleteAccount() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del("/me"),
    onSuccess: () => qc.clear(),
  });
}
