import { extractText, getDocumentProxy } from "unpdf";
import { errors } from "@/lib/errors";

/**
 * Pull text out of an uploaded PDF.
 *
 * Deliberately capped. A 400 page textbook is not a study deck, and letting one
 * through means either a truncated deck the user does not realise is truncated,
 * or a Worker that runs out of CPU time. Refusing with a clear message is the
 * better failure.
 */

export const MAX_PAGES = 40;
export const MAX_CHARS = 60_000;

export interface ExtractedPdf {
  text: string;
  pages: number;
  /** True when the document was longer than the cap and we read only part. */
  truncated: boolean;
}

export async function extractPdf(bytes: ArrayBuffer): Promise<ExtractedPdf> {
  let document;
  try {
    document = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw errors.invalid(
      "That file could not be opened. Make sure it is a PDF and not password protected.",
    );
  }

  const totalPages = document.numPages;
  const pagesToRead = Math.min(totalPages, MAX_PAGES);

  // `mergePages: true` makes unpdf return a single string, and its types are
  // precise enough that the compiler narrows the array branch to `never`. Take
  // the string directly rather than writing a branch that can never run.
  const { text: merged } = await extractText(document, { mergePages: true });

  const cleaned = tidy(merged);

  // A scanned PDF parses fine and yields almost nothing, which would otherwise
  // produce a confident deck about nothing. Catch it here and say so.
  if (cleaned.length < 200) {
    throw errors.invalid(
      "There is almost no readable text in that PDF. If it is a scan, photograph the pages instead and Retenit will read them.",
    );
  }

  return {
    text: cleaned.slice(0, MAX_CHARS),
    pages: pagesToRead,
    truncated: totalPages > MAX_PAGES || cleaned.length > MAX_CHARS,
  };
}

/**
 * PDF text extraction produces a lot of noise: hyphenated line breaks, running
 * headers, page numbers on their own line. Left in, all of it ends up quoted
 * back at the user inside a summary.
 */
function tidy(input: string): string {
  return input
    // Rejoin words split across a line break.
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2")
    // A line that is only a number is a page number.
    .replace(/^\s*\d{1,4}\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
