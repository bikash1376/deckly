import TextRecognition from "@react-native-ml-kit/text-recognition";

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

/**
 * Warm the Play Services model so the first real scan does not sit waiting.
 *
 * Because the app uses the unbundled ML Kit variant (see
 * plugins/with-unbundled-mlkit.js), the model is fetched on demand rather than
 * shipped in the APK. Running one throwaway recognition during onboarding pulls
 * it down while the user is reading, instead of while they are waiting.
 *
 * Failure is fine and silent: it just means the first scan pays the download.
 */
export async function prefetchOcrModel(sampleUri: string): Promise<void> {
  try {
    await TextRecognition.recognize(sampleUri);
  } catch {
    // Nothing to do. The model downloads on first real use instead.
  }
}
