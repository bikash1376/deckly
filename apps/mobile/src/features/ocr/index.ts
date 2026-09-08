import TextRecognition from "@react-native-ml-kit/text-recognition";
import { File, Paths } from "expo-file-system";

/**
 * On device OCR, with a server vision fallback.
 *
 * ML Kit is excellent on printed text, which is the overwhelming majority of
 * what a student photographs: textbook pages, slides, a whiteboard. It is
 * mediocre on handwriting and blind to diagrams, tables and maths notation.
 *
 * So this runs on device first, free and offline, and only offers the paid
 * vision model when the result looks thin. The heuristic is deliberately crude:
 * a wrong guess costs a suggestion the user can decline, not a wasted credit.
 */

export interface OcrResult {
  text: string;
  /** Number of text blocks found. Zero or one on a full page means trouble. */
  blocks: number;
  /** Whether the result looks poor enough to be worth offering the fallback. */
  shouldOfferFallback: boolean;
}

/** Below this a full page photo almost certainly failed to read properly. */
const THIN_TEXT_CHARS = 120;

export async function recognise(imageUri: string): Promise<OcrResult> {
  const result = await TextRecognition.recognize(imageUri);
  const text = result.text.trim();

  return {
    text,
    blocks: result.blocks.length,
    shouldOfferFallback: text.length < THIN_TEXT_CHARS || result.blocks.length <= 1,
  };
}

/** A 1x1 white PNG. Small enough to be free, real enough to be a valid image. */
const WARMUP_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let warmed = false;

/**
 * Warm the Play Services text recognition model.
 *
 * Because the app uses the unbundled ML Kit variant (see
 * plugins/with-unbundled-mlkit.js), the model is fetched on demand rather than
 * shipped in the APK, so the very first scan would otherwise sit waiting on a
 * download. Constructing a recogniser is what triggers that fetch, so running
 * one throwaway pass while the user is reading onboarding moves the wait
 * somewhere they will not notice it.
 *
 * Entirely best effort. If Play Services defers the download, or the write
 * fails, or the module is simply unavailable, the first real scan pays the cost
 * exactly as it would have anyway. Nothing here is allowed to throw.
 */
export async function prefetchOcrModel(): Promise<void> {
  if (warmed) return;
  warmed = true;

  try {
    const file = new File(Paths.cache, "deckly-ocr-warmup.png");
    if (!file.exists) {
      file.create({ overwrite: true });
      file.write(base64ToBytes(WARMUP_PNG_BASE64));
    }
    await TextRecognition.recognize(file.uri);
  } catch {
    // Deliberately silent. A failed warmup is invisible to the user; a thrown
    // one during onboarding would not be.
    warmed = false;
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
