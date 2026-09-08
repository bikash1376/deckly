import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { createApi, type Api } from "./api";

/**
 * The API client bound to the current Clerk session.
 *
 * `getToken` is called per request rather than captured once, so a token that
 * expires mid-session refreshes without the caller knowing anything happened.
 */
export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi(() => getToken()), [getToken]);
}
