import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, useWindowDimensions, View } from "react-native";
import type { WebView as WebViewType, WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  ArrowClockwiseIcon as ArrowClockwise,
  ArrowLeftIcon as ArrowLeft,
  ArrowSquareOutIcon as ArrowSquareOut,
  XIcon as X,
} from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { raw, shadow } from "@/theme";

/**
 * Google results for a selection, in a sheet over the note.
 *
 * A real WebView loading the ordinary results page, not scraped and not
 * reformatted: whatever Google serves is what you see. It is a top level
 * navigation rather than an iframe, which is why the X-Frame-Options header
 * that blocks embedding on the web does not apply here.
 *
 * Two things it does deliberately:
 *
 * The user agent is a current Chrome string. Android's stock WebView agent
 * gets served a stripped down or "update your browser" page, which looks like
 * our bug rather than Google's choice.
 *
 * Anything that is not a Google page opens in the real browser instead. Tapping
 * a result should hand off to a browser with the user's sessions, extensions
 * and password manager, not trap them in a chrome-less webview inside a notes
 * app.
 */

/**
 * Loaded defensively.
 *
 * react-native-webview is a native module, so a development build made before
 * it was added has the JavaScript but not the native side, and rendering it
 * throws. Requiring it inside a try lets an older build fall back to opening
 * the browser instead of crashing the notes screen, which matters because the
 * only way to get the native half is a fresh build.
 */
function loadWebView(): typeof WebViewType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-webview");
    return mod?.WebView ?? null;
  } catch {
    return null;
  }
}

const WebView = loadWebView();

const CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";

export interface LookupSheetProps {
  /** The selected text. Empty closes the sheet. */
  query: string;
  onClose: () => void;
}

export function LookupSheet({ query, onClose }: LookupSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const webview = useRef<WebViewType>(null);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const url = useMemo(
    () => `https://www.google.com/search?q=${encodeURIComponent(query.slice(0, 200))}`,
    [query],
  );

  const openExternally = useCallback(() => {
    Linking.openURL(url).catch(() => {});
  }, [url]);

  const onNavigate = useCallback((event: WebViewNavigation) => {
    setCanGoBack(event.canGoBack);
  }, []);

  // No native WebView in this build. Hand off to the browser and get out of
  // the way rather than showing an empty sheet.
  useEffect(() => {
    if (!WebView) {
      openExternally();
      onClose();
    }
  }, [openExternally, onClose]);

  // After every hook, never before: an early return above them would change
  // the hook count between renders and crash with "rendered fewer hooks than
  // expected".
  if (!WebView) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={[shadow.floating, { height: height * 0.82, paddingBottom: insets.bottom }]}
      className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-sheet bg-bg"
    >
      <View className="flex-row items-center gap-2 px-gutter pb-3 pt-4">
        {canGoBack ? (
          <IconButton
            icon={ArrowLeft}
            tone="sunken"
            size="sm"
            accessibilityLabel="Back"
            onPress={() => webview.current?.goBack()}
          />
        ) : null}

        <View className="flex-1">
          <Text variant="overline">Looking up</Text>
          <Text variant="subheading" numberOfLines={1}>
            {query}
          </Text>
        </View>

        <IconButton
          icon={ArrowSquareOut}
          tone="sunken"
          size="sm"
          accessibilityLabel="Open in browser"
          onPress={openExternally}
        />
        <IconButton
          icon={X}
          tone="sunken"
          size="sm"
          accessibilityLabel="Close"
          onPress={onClose}
        />
      </View>

      <View className="flex-1 bg-surface">
        {failed ? (
          <View className="flex-1 items-center justify-center gap-3 px-8">
            <Text variant="heading" className="text-center">
              Could not load results
            </Text>
            <Text variant="body" className="text-center text-ink-muted">
              Check your connection, or open the search in your browser instead.
            </Text>
            <View className="mt-2 w-full gap-2">
              <Button
                label="Try again"
                variant="secondary"
                size="md"
                icon={ArrowClockwise}
                onPress={() => {
                  setFailed(false);
                  setLoading(true);
                  webview.current?.reload();
                }}
              />
              <Button label="Open in browser" size="md" onPress={openExternally} />
            </View>
          </View>
        ) : (
          <>
            <WebView
              ref={webview}
              source={{ uri: url }}
              userAgent={CHROME_UA}
              onNavigationStateChange={onNavigate}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
              // Leaving Google hands off to the real browser, where the user
              // has their sessions and their password manager.
              onShouldStartLoadWithRequest={(request) => {
                if (request.url.includes("google.")) return true;
                Linking.openURL(request.url).catch(() => {});
                return false;
              }}
              setSupportMultipleWindows={false}
              // Results are long. Letting the page own the scroll keeps it
              // from fighting the sheet.
              nestedScrollEnabled
              className="flex-1"
            />

            {loading ? (
              <View className="absolute inset-0 gap-3 bg-surface p-gutter pt-6">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="mt-4 h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/6" />
              </View>
            ) : null}
          </>
        )}
      </View>
    </Animated.View>
  );
}
