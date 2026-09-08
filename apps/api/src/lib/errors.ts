import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Errors the app knows how to act on.
 *
 * `code` is the contract, not the HTTP status. The app branches on
 * `insufficient_credits` to open the paywall, and a status code alone cannot
 * carry that meaning without the client guessing.
 *
 * Messages are user facing: they say what happened and what to do about it, in
 * plain ASCII with no em dashes, because they are rendered directly.
 */
export type ErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_request"
  | "insufficient_credits"
  | "note_limit_reached"
  | "generation_failed"
  | "source_too_long"
  | "upload_failed"
  | "rate_limited"
  | "internal";

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  unauthorized: 401,
  not_found: 404,
  invalid_request: 400,
  insufficient_credits: 402,
  note_limit_reached: 402,
  generation_failed: 502,
  source_too_long: 413,
  upload_failed: 400,
  rate_limited: 429,
  internal: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): ContentfulStatusCode {
    return STATUS[this.code];
  }
}

export const errors = {
  unauthorized: () => new AppError("unauthorized", "Please sign in again."),

  notFound: (what = "That") => new AppError("not_found", `${what} could not be found.`),

  invalid: (message: string, detail?: unknown) =>
    new AppError("invalid_request", message, detail),

  insufficientCredits: (needed: number, have: number) =>
    new AppError(
      "insufficient_credits",
      `This costs ${needed} credits and you have ${have}. Upgrade for more, or come back when they reset.`,
      { needed, have },
    ),

  noteLimit: (limit: number) =>
    new AppError(
      "note_limit_reached",
      `The free plan holds ${limit} notes. Upgrade to write as many as you like.`,
    ),

  generationFailed: () =>
    new AppError(
      "generation_failed",
      "The model did not return something usable. Your credits were not spent, so try again.",
    ),

  sourceTooLong: (max: number) =>
    new AppError(
      "source_too_long",
      `That is longer than we can read in one go. Try a section of up to about ${max} characters.`,
    ),

  rateLimited: () =>
    new AppError("rate_limited", "That is a lot of requests at once. Wait a moment and try again."),

  internal: () =>
    new AppError("internal", "Something went wrong on our side. Try again in a moment."),
};

export function toResponse(c: Context, error: unknown) {
  if (error instanceof AppError) {
    return c.json({ code: error.code, message: error.message, detail: error.detail }, error.status);
  }

  // Never leak an internal message to the client. The real one goes to the log,
  // where Workers observability will surface it.
  console.error("unhandled", error);
  const fallback = errors.internal();
  return c.json({ code: fallback.code, message: fallback.message }, fallback.status);
}
