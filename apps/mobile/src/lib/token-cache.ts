import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";

/**
 * Clerk session tokens are kept in the Android keystore, not AsyncStorage.
 *
 * SecureStore can throw rather than return null when the keystore entry exists
 * but cannot be decrypted, which happens after a restore to a new device. A
 * throw here would leave the app stuck on a blank screen at launch, so a failed
 * read deletes the bad entry and reports "signed out", which recovers into the
 * sign in screen instead.
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Nothing useful to do. Losing the cache costs the user a re-login,
      // which is better than crashing the launch path.
    }
  },
};
