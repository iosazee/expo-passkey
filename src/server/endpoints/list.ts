/**
 * @file List passkeys endpoint
 * @description Implementation of the endpoint to list user passkeys with WebAuthn info
 */

import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { APIError } from "better-call";

import { ERROR_CODES, ERROR_MESSAGES } from "../../types/errors";
import type { Logger } from "../utils/logger";
import {
  listPasskeysParamsSchema,
  listPasskeysQuerySchema,
} from "../utils/schema";

import type { MobilePasskey } from "../../types";

/**
 * Create endpoint to list user passkeys
 */
export const createListEndpoint = (options: { logger: Logger }) => {
  const { logger } = options;

  return createAuthEndpoint(
    "/expo-passkey/list/:userId",
    {
      method: "GET",
      params: listPasskeysParamsSchema,
      query: listPasskeysQuerySchema,
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          description: "Retrieve a list of registered passkeys for the user",
          tags: ["Authentication"],
          responses: {
            200: {
              description: "List of passkeys",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      passkeys: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            userId: { type: "string" },
                            credentialId: { type: "string" },
                            platform: { type: "string" },
                            lastUsed: {
                              type: "string",
                              format: "date-time",
                            },
                            status: {
                              type: "string",
                              enum: ["active", "revoked"],
                            },
                            aaguid: {
                              type: "string",
                              nullable: true,
                            },
                            createdAt: {
                              type: "string",
                              format: "date-time",
                            },
                            updatedAt: {
                              type: "string",
                              format: "date-time",
                            },
                            revokedAt: {
                              type: "string",
                              format: "date-time",
                              nullable: true,
                            },
                            revokedReason: {
                              type: "string",
                              nullable: true,
                            },
                            metadata: {
                              type: "object",
                              additionalProperties: true,
                            },
                          },
                        },
                      },
                      nextOffset: { type: "number", nullable: true },
                    },
                  },
                },
              },
            },
            401: {
              description: "Unauthorized",
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
      try {
        const userId = ctx.params.userId;
        const limit = parseInt(ctx.query.limit || "10", 10);
        const offset = ctx.query.offset ? parseInt(ctx.query.offset, 10) : 0;

        logger.debug("Passkey list request received:", {
          userId,
          limit,
          offset,
        });

        // Verify session matches userId for security
        if (ctx.context.session?.user?.id !== userId) {
          logger.warn("Unauthorized attempt to list passkeys", {
            requestedUserId: userId,
            sessionUserId: ctx.context.session?.user?.id,
          });
          throw new APIError("UNAUTHORIZED", {
            code: "UNAUTHORIZED_ACCESS",
            message: "You can only view your own passkeys",
          });
        }

        // Fetch passkeys with pagination
        const passkeys = await ctx.context.adapter.findMany<MobilePasskey>({
          model: "mobilePasskey",
          where: [
            { field: "userId", operator: "eq", value: userId },
            { field: "status", operator: "eq", value: "active" },
          ],
          sortBy: { field: "lastUsed", direction: "desc" },
          limit: limit + 1,
          offset,
        });

        // Check if there are more results
        const hasMore = passkeys.length > limit;
        const results = hasMore ? passkeys.slice(0, limit) : passkeys;

        // Format passkeys for response
        const formattedPasskeys = results.map((passkey) => ({
          id: passkey.id,
          userId: passkey.userId,
          credentialId: passkey.credentialId,
          platform: passkey.platform,
          lastUsed: passkey.lastUsed,
          status: passkey.status,
          aaguid: passkey.aaguid || null,
          createdAt: passkey.createdAt,
          updatedAt: passkey.updatedAt,
          revokedAt: passkey.revokedAt,
          revokedReason: passkey.revokedReason,
          metadata: passkey.metadata
            ? JSON.parse(passkey.metadata as string)
            : {},
        }));

        logger.debug("Returning passkeys:", {
          count: formattedPasskeys.length,
          hasMore,
          nextOffset: hasMore ? offset + limit : undefined,
        });

        return ctx.json({
          passkeys: formattedPasskeys,
          nextOffset: hasMore ? offset + limit : undefined,
        });
      } catch (error) {
        logger.error("Error listing passkeys:", error);

        if (error instanceof APIError) {
          throw error;
        }

        throw new APIError("INTERNAL_SERVER_ERROR", {
          code: ERROR_CODES.SERVER.PASSKEYS_RETRIEVAL_FAILED,
          message: ERROR_MESSAGES[ERROR_CODES.SERVER.PASSKEYS_RETRIEVAL_FAILED],
        });
      }
    },
  );
};
