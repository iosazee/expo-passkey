/**
 * @file Server core implementation
 * @description Core implementation of the Expo Passkey server plugin with WebAuthn support
 */

import { createAuthEndpoint } from "better-auth/api";

import { resolveSession } from "./utils/session";
import type { BetterAuthPlugin } from "better-auth/types";
import { APIError } from "better-call";

import { ERROR_CODES, ERROR_MESSAGES } from "../types/errors";
import type { ExpoPasskeyOptions, ResolvedSchemaConfig } from "../types/server";

/**
 * Minimal structural type for the Better Auth context.
 *
 * `AuthContext` moved between better-auth 1.3 (exported from
 * `better-auth/types`) and 1.6+ (exported only from
 * `@better-auth/core`). Importing from either path pins the plugin
 * to one version. We only touch `adapter` here, so a structural
 * type keeps the plugin compatible across the peer-dep range.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthCtxLike = { adapter: any };

import {
  createAuthenticateEndpoint,
  createChallengeEndpoint,
  createListEndpoint,
  createRegisterEndpoint,
  createRevokeEndpoint,
} from "./endpoints";
import { createLogger, createRateLimits, setupCleanupJob } from "./utils";

// Store cleanup intervals globally so they can be cleared in tests
const cleanupIntervals: NodeJS.Timeout[] = [];

/**
 * Clears all cleanup intervals
 */
export function clearCleanupIntervals(): void {
  cleanupIntervals.forEach((interval) => clearInterval(interval));
  cleanupIntervals.length = 0;
}

/**
 * Resolves schema configuration with defaults
 */
function resolveSchemaConfig(
  options: ExpoPasskeyOptions,
): ResolvedSchemaConfig {
  return {
    authPasskeyModel: options.schema?.authPasskey?.modelName || "authPasskey",
    passkeyChallengeModel:
      options.schema?.passkeyChallenge?.modelName || "passkeyChallenge",
  };
}

/**
 * Creates an instance of the Expo Passkey server plugin with WebAuthn support
 * @param options Configuration options for the plugin
 * @returns BetterAuthPlugin instance
 */
export const expoPasskey = (options: ExpoPasskeyOptions): BetterAuthPlugin => {
  // Initialize logger
  const logger = createLogger(options.logger);

  // Validate required options
  if (!options.rpName || !options.rpId) {
    throw new Error("rpName and rpId are required options");
  }

  // Resolve schema configuration
  const schemaConfig = resolveSchemaConfig(options);

  // Configure endpoints with options and schema config
  const challengeEndpoint = createChallengeEndpoint({
    logger,
    schemaConfig,
  });

  const registerEndpoint = createRegisterEndpoint({
    rpName: options.rpName,
    rpId: options.rpId,
    origin: options.origin,
    logger,
    schemaConfig,
  });

  const authenticateEndpoint = createAuthenticateEndpoint({
    rpId: options.rpId,
    origin: options.origin,
    logger,
    schemaConfig,
  });

  const listEndpoint = createListEndpoint({
    logger,
    schemaConfig,
  });

  const revokeEndpoint = createRevokeEndpoint({
    logger,
    schemaConfig,
  });

  // Configure rate limits
  const rateLimits = createRateLimits(options.rateLimit);

  return {
    id: "expo-passkey",

    // Database schema for plugin
    schema: {
      [schemaConfig.authPasskeyModel]: {
        modelName: schemaConfig.authPasskeyModel,
        fields: {
          userId: {
            type: "string",
            required: true,
            references: {
              model: "user",
              field: "id",
              onDelete: "cascade",
            },
          },
          credentialId: {
            type: "string",
            required: true,
            unique: true,
          },
          publicKey: {
            type: "string", // Base64 encoded public key
            required: true,
          },
          counter: {
            type: "number", // For WebAuthn signature verification
            required: true,
            defaultValue: 0,
          },
          platform: {
            type: "string",
            required: true,
          },
          lastUsed: {
            type: "string",
            required: true,
          },
          status: {
            type: "string",
            required: true,
            defaultValue: "active",
          },
          createdAt: {
            type: "string",
            required: true,
          },
          updatedAt: {
            type: "string",
            required: true,
          },
          revokedAt: {
            type: "string",
            required: false,
          },
          revokedReason: {
            type: "string",
            required: false,
          },
          metadata: {
            type: "string",
            required: false,
          },
          aaguid: {
            type: "string", // For identifying the provider (e.g., Google, Apple)
            required: false,
          },
        },
      },
      [schemaConfig.passkeyChallengeModel]: {
        modelName: schemaConfig.passkeyChallengeModel,
        fields: {
          userId: {
            type: "string",
            required: true,
          },
          challenge: {
            type: "string", // Base64 encoded challenge
            required: true,
          },
          type: {
            type: "string", // 'registration' or 'authentication'
            required: true,
          },
          createdAt: {
            type: "string",
            required: true,
          },
          expiresAt: {
            type: "string",
            required: true,
          },
          registrationOptions: {
            type: "string", // JSON string containing registration preferences
            required: false,
          },
        },
      },
    },

    // Plugin initialization
    init: (ctx: AuthCtxLike) => {
      if (process.env.NODE_ENV !== "production") {
        logger.info(
          "Initializing Expo Passkey plugin with WebAuthn support...",
        );
      }

      // Set up cleanup jobs

      // 1. Cleanup for inactive passkeys
      if (options.cleanup?.inactiveDays) {
        const cleanupInterval = setupCleanupJob(
          ctx,
          options.cleanup,
          logger,
          schemaConfig,
        );
        if (cleanupInterval) {
          cleanupIntervals.push(cleanupInterval);
        }
      }

      // 2. Cleanup for expired challenges
      const cleanupExpiredChallenges = async () => {
        const now = new Date().toISOString();

        try {
          const result = await ctx.adapter.deleteMany({
            model: schemaConfig.passkeyChallengeModel,
            where: [{ field: "expiresAt", operator: "lt", value: now }],
          });

          if (process.env.NODE_ENV !== "production") {
            logger.info(`Cleaned up ${result} expired passkey challenges`);
          }
        } catch (error) {
          logger.error("Passkey challenge cleanup job failed:", error);
        }
      };

      // Run challenge cleanup immediately and then every hour
      cleanupExpiredChallenges();

      // Store the interval so it can be cleared in tests
      const intervalId = setInterval(cleanupExpiredChallenges, 60 * 60 * 1000);
      cleanupIntervals.push(intervalId);
    },

    // Middleware for all expo-passkey endpoints
    middlewares: [
      // Conditional session middleware for challenge endpoint
      {
        path: "/expo-passkey/challenge",
        middleware: createAuthEndpoint(
          "/expo-passkey/challenge-guard",
          {
            method: "POST",
          },
          async (ctx) => {
            const body = ctx.body as { type?: string };

            // For registration challenges, require session.
            // resolveSession is defensive against better-auth 1.6's
            // runWithRequestState propagation issues — see
            // ./utils/session.ts for the long-form rationale.
            if (body?.type === "registration") {
              let session;
              try {
                session = await resolveSession(ctx, logger);
              } catch (sessionError) {
                logger.debug("Session fetch failed for registration challenge", {
                  error:
                    sessionError instanceof Error
                      ? sessionError.message
                      : String(sessionError),
                });
                session = null;
              }

              if (!session?.user?.id) {
                logger.warn("Registration challenge requires authentication");
                throw new APIError("UNAUTHORIZED", {
                  code: "SESSION_REQUIRED",
                  message: "You must be logged in to register a passkey",
                });
              }
            }

            // For authentication challenges, allow without session
            // No action needed - request continues to endpoint handler
          },
        ),
      },
      // Origin validation for all expo-passkey endpoints
      {
        path: "/expo-passkey/**",
        middleware: createAuthEndpoint(
          "/expo-passkey",
          {
            method: "GET",
          },
          async (ctx) => {
            if (!ctx.headers) {
              logger.warn("Missing headers in request");
              throw new APIError("UNAUTHORIZED", {
                code: ERROR_CODES.SERVER.INVALID_CLIENT,
                message: ERROR_MESSAGES[ERROR_CODES.SERVER.INVALID_CLIENT],
              });
            }

            const origin = ctx.headers.get("origin");
            if (origin && !ctx.context.trustedOrigins.includes(origin)) {
              logger.warn("Invalid origin in request", { origin });
              throw new APIError("UNAUTHORIZED", {
                code: ERROR_CODES.SERVER.INVALID_ORIGIN,
                message: ERROR_MESSAGES[ERROR_CODES.SERVER.INVALID_ORIGIN],
              });
            }
          },
        ),
      },
    ],

    // Endpoint implementations
    endpoints: {
      passkeyChallenges: challengeEndpoint,
      registerPasskey: registerEndpoint,
      authenticatePasskey: authenticateEndpoint,
      listPasskeys: listEndpoint,
      revokePasskey: revokeEndpoint,
    },

    // Rate limiting configuration
    rateLimit: rateLimits,

    // Error codes exposed for client use.
    //
    // Better Auth 1.6+ tightened this slot to `Record<string, RawError>`
    // where each value is `{ readonly code, message }`. We wrap our
    // existing flat string-keyed map at the assignment site without
    // touching the public `ERROR_CODES` export — consumers can keep
    // reading `ERROR_CODES.SERVER.X` as a string. Cast-through-unknown
    // keeps the build green on the older 1.3.x type that expected
    // `Record<string, string>` too.
    $ERROR_CODES: buildRawErrorCodes(),
  };
};

function buildRawErrorCodes(): Record<string, { code: string; message: string }> {
  return Object.fromEntries(
    Object.entries(ERROR_CODES.SERVER).map(([key, code]) => [
      key,
      { code, message: ERROR_MESSAGES[code] ?? code },
    ]),
  );
}
