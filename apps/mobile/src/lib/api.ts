import type { ZodType } from "zod";
import { env } from "./env";
import { cleanDeep } from "./copy";

/**
 * Typed client for the Worker API.
 *
 * Every response is parsed through its Zod schema, then run through
 * `cleanDeep`. Parsing catches a shape drift between the app and the Worker at
 * the boundary instead of as an undefined three components deep; cleaning is
 * where the no em dash rule is actually enforced on model output.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The paywall listens for this rather than sniffing status codes. */
  get isOutOfCredits() {
    return this.code === "insufficient_credits";
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

export type TokenGetter = () => Promise<string | null>;

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: ZodType<T>;
  signal?: AbortSignal;
}

async function request<T>(
  getToken: TokenGetter,
  path: string,
  { method = "GET", body, schema, signal }: RequestOptions<T> = {},
): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${env.apiUrl}${path}`, {
    method,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    const code = (payload as { code?: string } | null)?.code ?? "unknown";
    const message =
      (payload as { message?: string } | null)?.message ??
      "Something went wrong. Check your connection and try again.";
    throw new ApiError(response.status, code, message);
  }

  if (!schema) return payload as T;

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      "bad_response",
      "The server sent something this version of the app cannot read. Updating the app should fix it.",
    );
  }

  return cleanDeep(parsed.data);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Bound to a token getter rather than reading auth from a module global, so a
 * sign out cannot leave a stale token in a closure somewhere.
 */
export function createApi(getToken: TokenGetter) {
  return {
    get: <T>(path: string, schema?: ZodType<T>, signal?: AbortSignal) =>
      request<T>(getToken, path, { schema, signal }),

    post: <T>(path: string, body?: unknown, schema?: ZodType<T>, signal?: AbortSignal) =>
      request<T>(getToken, path, { method: "POST", body, schema, signal }),

    patch: <T>(path: string, body?: unknown, schema?: ZodType<T>) =>
      request<T>(getToken, path, { method: "PATCH", body, schema }),

    del: (path: string) => request<void>(getToken, path, { method: "DELETE" }),
  };
}

export type Api = ReturnType<typeof createApi>;
