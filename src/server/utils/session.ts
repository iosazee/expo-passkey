/**
 * @file Session resolution utilities
 * @description Backward-compatible session lookup that works across
 * better-auth 1.5.x and 1.6+.
 *
 * better-auth 1.6 introduced an AsyncLocalStorage-based request-state
 * context (`runWithRequestState`). Some code paths inside `getSession`
 * (notably the cookie-cache fast path's `getShouldSkipSessionRefresh()`
 * call) require that context to be active. When a plugin endpoint calls
 * `getSessionFromCtx(ctx)` and the async-context propagation fails for
 * any reason — multiple `@better-auth/core` copies in the dep graph,
 * a hook spawning work outside the parent's async context, certain
 * serverless runtimes — the internal `getSession` handler throws:
 *
 *   "No request state found. Please make sure you are calling this
 *    function within a `runWithRequestState` callback."
 *
 * That error is swallowed by `getSessionFromCtx`'s `.catch(() => null)`
 * and surfaces to the caller as "no session", producing spurious
 * UNAUTHORIZED responses for users who are in fact signed in.
 *
 * `resolveSession` and `passkeySessionMiddleware` defend against that
 * by trying the standard helper first and, on failure or null-with-cookie,
 * falling back to a direct `internalAdapter.findSession` lookup that
 * bypasses the state machinery entirely.
 */

import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { APIError } from "better-call";

import type { Logger } from "./logger";

/**
 * Minimal shape of the resolved session this package consumes.
 * Matches better-auth's `{ session, user }` return shape — additional
 * fields are passed through untouched.
 */
export interface ResolvedSession {
  session: {
    id?: string;
    token?: string;
    userId?: string;
    expiresAt?: Date | string;
    [k: string]: unknown;
  };
  user: {
    id: string;
    email?: string;
    name?: string | null;
    [k: string]: unknown;
  };
}

type Ctx = Parameters<typeof getSessionFromCtx>[0];

function pickStr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Resilient session lookup.
 *
 * Order of attempts:
 *   1. `getSessionFromCtx(ctx)` — the standard better-auth helper.
 *      Works on every version when the request-state context is intact.
 *   2. Direct cookie + adapter lookup — read the signed session cookie
 *      and resolve via `ctx.context.internalAdapter.findSession`. This
 *      avoids the `runWithRequestState` path entirely.
 *
 * Returns `null` only when both paths agree there is no session (or no
 * recoverable session cookie is present).
 */
export async function resolveSession(
  ctx: Ctx,
  logger?: Logger,
): Promise<ResolvedSession | null> {
  let stdResult: ResolvedSession | null = null;
  let stdError: unknown = null;

  try {
    const result = (await getSessionFromCtx(
      ctx as Parameters<typeof getSessionFromCtx>[0],
    )) as ResolvedSession | null;
    if (result?.session && result?.user?.id) {
      return result;
    }
    stdResult = result;
  } catch (err) {
    stdError = err;
  }

  // If the standard helper returned a non-null-but-incomplete value
  // and didn't throw, trust it (no need to fall back).
  if (stdResult !== null && !stdError) {
    return stdResult;
  }

  // Fallback path. We only take this when:
  //   - getSessionFromCtx threw (likely a runWithRequestState issue), OR
  //   - it returned null (could be "no cookie" or a swallowed throw).
  try {
    const anyCtx = ctx as unknown as {
      context?: {
        authCookies?: { sessionToken?: { name?: string } };
        secret?: string;
        internalAdapter?: {
          findSession?: (token: string) => Promise<ResolvedSession | null>;
        };
        session?: ResolvedSession | null;
      };
      getSignedCookie?: (
        name: string,
        secret: string,
      ) => Promise<string | false | undefined>;
    };

    const cookieName = pickStr(anyCtx?.context?.authCookies?.sessionToken?.name);
    const secret = pickStr(anyCtx?.context?.secret);
    if (
      !cookieName ||
      !secret ||
      typeof anyCtx?.getSignedCookie !== "function" ||
      typeof anyCtx?.context?.internalAdapter?.findSession !== "function"
    ) {
      // Nothing to fall back on; honour whatever the standard helper said.
      return stdResult;
    }

    const token = await anyCtx.getSignedCookie(cookieName, secret);
    if (!token) {
      // No session cookie means the user really is signed out.
      return null;
    }

    // Narrow context + adapter via local bindings — the existence checks
    // above already guarantee both are present, so no need for the
    // eslint-flagged non-null assertions.
    const adapterCtx = anyCtx.context;
    const findSession = adapterCtx?.internalAdapter?.findSession;
    if (!adapterCtx || !findSession) {
      return stdResult;
    }
    const session = await findSession(token as string);
    if (!session?.session || !session?.user?.id) {
      return null;
    }

    // Honor the standard helper's side-effect of populating ctx.context.session
    // so downstream reads see a consistent value.
    if (anyCtx?.context) {
      anyCtx.context.session = session;
    }

    if (stdError && logger) {
      logger.debug?.(
        "resolveSession: standard lookup threw; fell back to direct adapter",
        {
          error: stdError instanceof Error ? stdError.message : String(stdError),
        },
      );
    }

    return session;
  } catch (fallbackErr) {
    logger?.debug?.("resolveSession: fallback lookup failed", {
      error:
        fallbackErr instanceof Error
          ? fallbackErr.message
          : String(fallbackErr),
    });
    return stdResult;
  }
}

/**
 * Drop-in replacement for better-auth's `sessionMiddleware` that uses
 * `resolveSession` under the hood. Apply via `use: [passkeySessionMiddleware]`
 * on any endpoint that requires an authenticated session.
 */
export const passkeySessionMiddleware = createAuthMiddleware(async (ctx) => {
  const session = await resolveSession(ctx as Ctx);
  if (!session?.session || !session?.user?.id) {
    throw new APIError("UNAUTHORIZED", {
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }
  return { session };
});
