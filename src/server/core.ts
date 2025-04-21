/**
 * @file Server core implementation
 * @description Core implementation of the Expo Passkey server plugin with WebAuthn support
 */

import { createAuthEndpoint } from "better-auth/api";
import type { AuthContext, BetterAuthPlugin } from "better-auth/types";
import { APIError } from "better-call";

import { ERROR_CODES, ERROR_MESSAGES } from "../types/errors";
import type { ExpoPasskeyOptions } from "../types/server";

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

  // Configure endpoints with options
  const challengeEndpoint = createChallengeEndpoint({
    logger,
  });

  const registerEndpoint = createRegisterEndpoint({
    rpName: options.rpName,
    rpId: options.rpId,
    origin: options.origin,
    logger,
  });

  const authenticateEndpoint = createAuthenticateEndpoint({
    rpId: options.rpId,
    origin: options.origin,
    logger,
  });

  const listEndpoint = createListEndpoint({
    logger,
  });

  const revokeEndpoint = createRevokeEndpoint({
    logger,
  });

  // Configure rate limits
  const rateLimits = createRateLimits(options.rateLimit);

  return {
    id: "expo-passkey",

    // Database schema for plugin
    schema: {
      mobilePasskey: {
        modelName: "mobilePasskey",
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
      passkeyChallenge: {
        modelName: "passkeyChallenge",
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
        },
      },
    },

    // Plugin initialization
    init: (ctx: AuthContext) => {
      if (process.env.NODE_ENV !== "production") {
        logger.info(
          "Initializing Expo Passkey plugin with WebAuthn support...",
        );
      }

      // Set up cleanup jobs

      // 1. Cleanup for inactive passkeys
      if (options.cleanup?.inactiveDays) {
        const cleanupInterval = setupCleanupJob(ctx, options.cleanup, logger);
        if (cleanupInterval) {
          cleanupIntervals.push(cleanupInterval);
        }
      }

      // 2. Cleanup for expired challenges
      const cleanupExpiredChallenges = async () => {
        const now = new Date().toISOString();

        try {
          const result = await ctx.adapter.deleteMany({
            model: "passkeyChallenge",
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

    // Error codes exposed for client use
    $ERROR_CODES: ERROR_CODES.SERVER,
  };
};
