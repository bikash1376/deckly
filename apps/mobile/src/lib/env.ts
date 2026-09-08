/**
 * Public runtime config.
 *
 * Only EXPO_PUBLIC_ values belong here, and every one of them is shipped inside
 * the APK where anyone can read it. Nothing secret ever appears in this file:
 * the Groq key, the Neon connection string and the RevenueCat secret key are
 * Worker secrets and the app never sees them.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Fail loudly at startup rather than with an opaque network error twenty
    // screens later.
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in, then restart the bundler with a cleared cache.`,
    );
  }
  return value;
}

export const env = {
  clerkPublishableKey: required(
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ),
  apiUrl: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),
  /** Android only for v1, so a single key rather than a platform switch. */
  revenueCatKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
  /**
   * A LanguageTool compatible endpoint for grammar checking, optional.
   *
   * Deliberately empty by default. LanguageTool's free public API forbids
   * automated requests from an app, so this must point at a self-hosted
   * instance. Unset, the grammar toggle stays disabled and says why.
   */
  grammarApiUrl: process.env.EXPO_PUBLIC_GRAMMAR_API_URL ?? "",
} as const;
