/**
 * @file WebAuthn challenge endpoint
 * @description Creates and stores challenges for WebAuthn registration and authentication
 */

import { createAuthEndpoint } from "better-auth/api";
import { APIError } from "better-call";
import crypto from "crypto";
import type { ResolvedSchemaConfig } from "../../types";
import type { Logger } from "../utils/logger";
import { challengeSchema } from "../utils/schema";

/**
 * Creates a WebAuthn challenge endpoint for registration and authentication
 */
export const createChallengeEndpoint = (options: {
  logger: Logger;
  schemaConfig: ResolvedSchemaConfig;
}) => {
  const { logger, schemaConfig } = options;

  return createAuthEndpoint(
    "/expo-passkey/challenge",
    {
      method: "POST",
      body: challengeSchema,
      metadata: {
        openapi: {
          description:
            "Generate a WebAuthn challenge for passkey registration or authentication",
          tags: ["Authentication"],
          responses: {
            200: {
              description: "Challenge successfully generated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      challenge: { type: "string" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid request",
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
      const { type, registrationOptions } = ctx.body;
      let userId: string;

      try {
        // For registration challenges, userId MUST come from authenticated session
        if (type === "registration") {
          if (!ctx.context.session?.user?.id) {
            logger.warn("Registration challenge requires authentication", {
              hasSession: !!ctx.context.session,
            });
            throw new APIError("UNAUTHORIZED", {
              code: "SESSION_REQUIRED",
              message: "You must be logged in to register a passkey",
            });
          }
          userId = ctx.context.session.user.id;

          // Verify user exists
          const user = await ctx.context.adapter.findOne({
            model: "user",
            where: [{ field: "id", operator: "eq", value: userId }],
          });

          if (!user) {
            logger.warn("Challenge generation failed: User not found", {
              userId,
            });
            throw new APIError("BAD_REQUEST", {
              code: "USER_NOT_FOUND",
              message: "User not found",
            });
          }
        } else {
          // For authentication challenges, userId can be provided by client or omitted for discoverable credentials
          userId = ctx.body.userId || "anonymous";
        }

        logger.debug("Generating WebAuthn challenge:", {
          userId,
          type,
        });

        // Generate a random challenge with sufficient entropy
        const randomBytes = crypto.randomBytes(32);
        const challenge = randomBytes.toString("base64url");

        // Calculate expiration (5 minutes from now)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

        // Store challenge in database
        await ctx.context.adapter.create({
          model: schemaConfig.passkeyChallengeModel,
          data: {
            id: ctx.context.generateId({
              model: schemaConfig.passkeyChallengeModel,
              size: 32,
            }),
            userId,
            challenge,
            type,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            // Store registration options if provided (for registration challenges)
            registrationOptions: registrationOptions
              ? JSON.stringify(registrationOptions)
              : null,
          },
          forceAllowId: true,
        });

        logger.debug("Challenge generated successfully", {
          userId,
          type,
          challengeLength: challenge.length,
        });

        // Return the challenge
        return ctx.json({
          challenge,
        });
      } catch (error) {
        logger.error("Failed to generate challenge:", error);
        if (error instanceof APIError) {
          throw error;
        }
        throw new APIError("INTERNAL_SERVER_ERROR", {
          code: "CHALLENGE_GENERATION_FAILED",
          message: "Failed to generate challenge",
        });
      }
    }
  );
};
