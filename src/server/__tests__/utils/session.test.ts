/**
 * Tests for resolveSession — the resilience helper that backstops
 * better-auth 1.6's runWithRequestState propagation issues.
 */

import {
  passkeySessionMiddleware,
  resolveSession,
} from "../../utils/session";

const { getSessionFromCtx } = jest.requireMock("better-auth/api") as {
  getSessionFromCtx: jest.Mock;
};

const FAKE_SESSION = {
  session: { id: "ses_1", token: "tok_abc", userId: "usr_1" },
  user: { id: "usr_1", email: "a@b.c" },
};

function makeCtx(overrides: {
  cookieValue?: string | false;
  findSession?: jest.Mock;
  cookieName?: string;
  secret?: string;
  getSignedCookie?: jest.Mock;
  internalAdapter?: unknown;
} = {}) {
  const getSignedCookie =
    overrides.getSignedCookie ??
    jest.fn(async (_name: string, _secret: string) =>
      overrides.cookieValue ?? "tok_abc",
    );
  const findSession =
    overrides.findSession ?? jest.fn(async () => FAKE_SESSION);
  const ctx: any = {
    getSignedCookie,
    context: {
      authCookies: { sessionToken: { name: overrides.cookieName ?? "ba-session" } },
      secret: overrides.secret ?? "s3cret",
      internalAdapter:
        overrides.internalAdapter === undefined
          ? { findSession }
          : overrides.internalAdapter,
      session: null,
    },
  };
  return { ctx, getSignedCookie, findSession };
}

describe("resolveSession", () => {
  beforeEach(() => {
    getSessionFromCtx.mockReset();
  });

  it("returns the standard helper's result when it succeeds", async () => {
    getSessionFromCtx.mockResolvedValueOnce(FAKE_SESSION);
    const { ctx, findSession } = makeCtx();

    const result = await resolveSession(ctx);

    expect(result).toBe(FAKE_SESSION);
    expect(findSession).not.toHaveBeenCalled();
  });

  it("falls back to the direct adapter lookup when the standard helper throws", async () => {
    getSessionFromCtx.mockRejectedValueOnce(
      new Error(
        "No request state found. Please make sure you are calling this function within a `runWithRequestState` callback.",
      ),
    );
    const { ctx, findSession } = makeCtx();

    const result = await resolveSession(ctx);

    expect(result).toEqual(FAKE_SESSION);
    expect(findSession).toHaveBeenCalledWith("tok_abc");
  });

  it("falls back when the standard helper returns null but a cookie is present", async () => {
    getSessionFromCtx.mockResolvedValueOnce(null);
    const { ctx, findSession } = makeCtx();

    const result = await resolveSession(ctx);

    expect(result).toEqual(FAKE_SESSION);
    expect(findSession).toHaveBeenCalledTimes(1);
  });

  it("returns null when no session cookie is present", async () => {
    getSessionFromCtx.mockResolvedValueOnce(null);
    const { ctx, findSession } = makeCtx({ cookieValue: false });

    const result = await resolveSession(ctx);

    expect(result).toBeNull();
    expect(findSession).not.toHaveBeenCalled();
  });

  it("returns null when the adapter cannot find the token", async () => {
    getSessionFromCtx.mockRejectedValueOnce(new Error("boom"));
    const findSession = jest.fn(async () => null);
    const { ctx } = makeCtx({ findSession });

    const result = await resolveSession(ctx);

    expect(result).toBeNull();
    expect(findSession).toHaveBeenCalledWith("tok_abc");
  });

  it("hydrates ctx.context.session so downstream reads see the result", async () => {
    getSessionFromCtx.mockRejectedValueOnce(new Error("boom"));
    const { ctx } = makeCtx();

    await resolveSession(ctx);

    expect(ctx.context.session).toEqual(FAKE_SESSION);
  });

  it("returns null from the fallback when the adapter is unavailable", async () => {
    getSessionFromCtx.mockResolvedValueOnce(null);
    const { ctx } = makeCtx({ internalAdapter: null });

    const result = await resolveSession(ctx);

    expect(result).toBeNull();
  });
});

describe("passkeySessionMiddleware", () => {
  beforeEach(() => {
    getSessionFromCtx.mockReset();
  });

  it("returns the resolved session when one exists", async () => {
    getSessionFromCtx.mockResolvedValueOnce(FAKE_SESSION);
    const { ctx } = makeCtx();

    const result = await (passkeySessionMiddleware as unknown as (
      c: unknown,
    ) => Promise<{ session: typeof FAKE_SESSION }>)(ctx);

    expect(result.session).toEqual(FAKE_SESSION);
  });

  it("throws UNAUTHORIZED when no session is resolvable", async () => {
    getSessionFromCtx.mockResolvedValueOnce(null);
    const { ctx } = makeCtx({ cookieValue: false });

    await expect(
      (passkeySessionMiddleware as unknown as (c: unknown) => Promise<unknown>)(
        ctx,
      ),
    ).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    });
  });
});
