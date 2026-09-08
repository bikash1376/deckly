import { useEffect, useState } from "react";
import * as Font from "expo-font";

import Geist_400Regular from "@expo-google-fonts/geist/400Regular/Geist_400Regular.ttf";
import Geist_600SemiBold from "@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf";
import Newsreader_400Regular from "@expo-google-fonts/newsreader/400Regular/Newsreader_400Regular.ttf";
import Newsreader_600SemiBold from "@expo-google-fonts/newsreader/600SemiBold/Newsreader_600SemiBold.ttf";
import Literata_400Regular from "@expo-google-fonts/literata/400Regular/Literata_400Regular.ttf";
import Literata_600SemiBold from "@expo-google-fonts/literata/600SemiBold/Literata_600SemiBold.ttf";
import Caveat_400Regular from "@expo-google-fonts/caveat/400Regular/Caveat_400Regular.ttf";
import Caveat_700Bold from "@expo-google-fonts/caveat/700Bold/Caveat_700Bold.ttf";
import Unkempt_400Regular from "@expo-google-fonts/unkempt/400Regular/Unkempt_400Regular.ttf";
import Unkempt_700Bold from "@expo-google-fonts/unkempt/700Bold/Unkempt_700Bold.ttf";

/**
 * The optional pad typefaces, loaded in the background.
 *
 * These are only ever used inside the note editor, so blocking the splash
 * screen on ten more faces would make every launch slower to serve a screen
 * most sessions never open. They load after the app is already interactive,
 * and until they are ready React Native falls back to the system face.
 *
 * Imported by per weight subpath rather than from the package index: those
 * indexes re-export every weight and italic, which is how the bundle quietly
 * grew to eighteen faces of Inter once already.
 */
const PAD_FONTS = {
  Geist_400Regular,
  Geist_600SemiBold,
  Newsreader_400Regular,
  Newsreader_600SemiBold,
  Literata_400Regular,
  Literata_600SemiBold,
  Caveat_400Regular,
  Caveat_700Bold,
  Unkempt_400Regular,
  Unkempt_700Bold,
};

let started = false;

export function usePadFonts(): boolean {
  const [loaded, setLoaded] = useState(() => Font.isLoaded("Caveat_400Regular"));

  useEffect(() => {
    if (loaded || started) return;
    started = true;

    Font.loadAsync(PAD_FONTS)
      .then(() => setLoaded(true))
      .catch(() => {
        // A failed load leaves the system face in place, which is legible.
        // Not worth an error state in front of someone trying to write.
        started = false;
      });
  }, [loaded]);

  return loaded;
}
