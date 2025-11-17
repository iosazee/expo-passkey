/**
 * @file Authenticate passkey endpoint
 * @description WebAuthn-based implementation for passkey authentication
 */

import {
  verifyAuthenticationResponse,
  type VerifyAuthenticationResponseOpts,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createAuthEndpoint } from "better-auth/api";
import { setCookieCache, setSessionCookie } from "better-auth/cookies";
import type { User } from "better-auth/types";
import { APIError } from "better-call";

import { ERROR_CODES, ERROR_MESSAGES } from "../../types/errors";
import type { Logger } from "../utils/logger";
import { authenticatePasskeySchema } from "../utils/schema";

import type {
  AuthPasskey,
  PasskeyChallenge,
  ResolvedSchemaConfig,
} from "../../types";

/**
 * Create WebAuthn passkey authentication endpoint
 */
export const createAuthenticateEndpoint = (options: {
  logger: Logger;
  rpId: string;
  origin?: string | string[];
  schemaConfig: ResolvedSchemaConfig;
}) => {
  const { logger, rpId, origin, schemaConfig } = options;

  // Convert to array of origins for consistency, or use empty array if undefined
  const expectedOrigins = origin
    ? Array.isArray(origin)
      ? origin
      : [origin]
    : [];

  return createAuthEndpoint(
    "/expo-passkey/authenticate",
    {
      method: "POST",
      body: authenticatePasskeySchema,
      metadata: {
        openapi: {
          description: "Authenticate using a registered WebAuthn passkey",
          tags: ["Authentication"],
          responses: {
            200: {
              description: "Authentication successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          email: { type: "string" },
                          emailVerified: { type: "boolean" },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: "Authentication failed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "object",
                        properties: {
                          code: { type: "string" },
                          message: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const { credential, metadata } = ctx.body;
      const credentialId = credential?.id;

      try {
        logger.debug("WebAuthn authentication attempt:", { credentialId });

        // Find the credential by its ID
        const passkey = await ctx.context.adapter.findOne<AuthPasskey>({
          model: schemaConfig.authPasskeyModel,
          where: [
            { field: "credentialId", operator: "eq", value: credentialId },
            { field: "status", operator: "eq", value: "active" },
          ],
        });

        if (!passkey) {
          logger.warn("Authentication failed: Invalid credential", {
            credentialId,
          });
          throw new APIError("UNAUTHORIZED", {
            code: ERROR_CODES.SERVER.INVALID_CREDENTIAL,
            message: ERROR_MESSAGES[ERROR_CODES.SERVER.INVALID_CREDENTIAL],
          });
        }

        // Get the latest challenge for this user
        const userChallenges =
          await ctx.context.adapter.findMany<PasskeyChallenge>({
            model: schemaConfig.passkeyChallengeModel,
            where: [
              { field: "userId", operator: "eq", value: passkey.userId },
              { field: "type", operator: "eq", value: "authentication" },
            ],
            sortBy: { field: "createdAt", direction: "desc" },
            limit: 1,
          });

        const autoDiscoveryChallenges =
          await ctx.context.adapter.findMany<PasskeyChallenge>({
            model: schemaConfig.passkeyChallengeModel,
            where: [
              { field: "userId", operator: "eq", value: "auto-discovery" },
              { field: "type", operator: "eq", value: "authentication" },
            ],
            sortBy: { field: "createdAt", direction: "desc" },
            limit: 1,
          });

        // Combine and sort to get the most recent challenge
        const allChallenges = [
          ...userChallenges,
          ...autoDiscoveryChallenges,
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const storedChallenge = allChallenges[0];

        if (!storedChallenge) {
          logger.warn("Authentication failed: No challenge found", {
            userId: passkey.userId,
          });
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_CHALLENGE",
            message: "No challenge found for authentication",
          });
        }

        // Check if challenge has expired
        if (new Date(storedChallenge.expiresAt) < new Date()) {
          logger.warn("Authentication failed: Challenge expired", {
            userId: passkey.userId,
          });
          throw new APIError("BAD_REQUEST", {
            code: "EXPIRED_CHALLENGE",
            message: "Challenge has expired. Please request a new one.",
          });
        }

        // Prepare credential for verification
        const verifiableCredential =
          credential as unknown as AuthenticationResponseJSON;

        try {
          // Create verification options
          const verificationOptions: VerifyAuthenticationResponseOpts = {
            response: verifiableCredential,
            expectedChallenge: storedChallenge.challenge,
            expectedOrigin: expectedOrigins,
            expectedRPID: rpId,
            requireUserVerification: true,
            credential: {
              id: passkey.credentialId,
              publicKey: isoBase64URL.toBuffer(passkey.publicKey),
              counter: passkey.counter,
            },
          };

          // Verify the authentication response
          const verification = await verifyAuthenticationResponse(
            verificationOptions
          );

          if (!verification.verified) {
            throw new Error("Verification failed");
          }

          // Find the user associated with the credential
          const user = await ctx.context.adapter.findOne<User>({
            model: "user",
            where: [{ field: "id", operator: "eq", value: passkey.userId }],
          });

          if (!user) {
            logger.error("Authentication failed: User not found", {
              credentialId,
              userId: passkey.userId,
            });
            throw new APIError("UNAUTHORIZED", {
              code: ERROR_CODES.SERVER.USER_NOT_FOUND,
              message: ERROR_MESSAGES[ERROR_CODES.SERVER.USER_NOT_FOUND],
            });
          }

          const now = new Date().toISOString();

          // Update passkey metadata and counter
          await ctx.context.adapter.update({
            model: schemaConfig.authPasskeyModel,
            where: [{ field: "id", operator: "eq", value: passkey.id }],
            update: {
              lastUsed: now,
              updatedAt: now,
              // Update counter from authentication response
              counter: verification.authenticationInfo.newCounter,
              metadata: JSON.stringify({
                ...JSON.parse(passkey.metadata || "{}"),
                ...metadata,
                lastAuthenticationAt: now,
              }),
            },
          });

          // Delete the used challenge
          await ctx.context.adapter.delete({
            model: schemaConfig.passkeyChallengeModel,
            where: [{ field: "id", operator: "eq", value: storedChallenge.id }],
          });

          // Create session token using internal adapter
          // We pass false to prevent automatic cookie setting
          const sessionToken = await ctx.context.internalAdapter.createSession(
            user.id,
            ctx,
            false
          );

          // Get session configuration from context
          const sessionConfig = ctx.context.options.session || {};

          // Calculate expiration based on configured expiresIn or default to 7 days
          const expiresInSeconds = sessionConfig.expiresIn || 7 * 24 * 60 * 60;
          const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

          // Create session data matching better-auth's expected structure
          const sessionData = {
            session: {
              // Standard session properties
              id: sessionToken.token,
              userId: user.id,
              token: sessionToken.token,
              expiresAt,
              createdAt: new Date(),
              updatedAt: new Date(),

              // Request metadata
              ipAddress:
                ctx.request?.headers?.get("x-forwarded-for") ||
                ctx.request?.headers?.get("x-real-ip") ||
                null,
              userAgent: ctx.request?.headers?.get("user-agent") || null,
            },
            user,
          };

          // Set the session cookie with our manually constructed data
          await setSessionCookie(ctx, sessionData);

          // Set session data cache if enabled in configuration
          if (sessionConfig.cookieCache?.enabled) {
            await setCookieCache(ctx, sessionData);
          }

          logger.info("WebAuthn authentication successful", {
            userId: user.id,
            credentialId,
          });

          // Return response with token and user data
          return ctx.json({
            token: sessionToken.token,
            user: sessionData.user,
          });
        } catch (verificationError) {
          logger.error("WebAuthn verification failed:", verificationError);
          throw new APIError("UNAUTHORIZED", {
            code: "VERIFICATION_FAILED",
            message:
              verificationError instanceof Error
                ? verificationError.message
                : "WebAuthn verification failed",
          });
        }
      } catch (error) {
        logger.error("Authentication error:", error);
        if (error instanceof APIError) {
          throw error;
        }
        throw new APIError("UNAUTHORIZED", {
          code: ERROR_CODES.SERVER.AUTHENTICATION_FAILED,
          message: ERROR_MESSAGES[ERROR_CODES.SERVER.AUTHENTICATION_FAILED],
        });
      }
    }
  );
};
