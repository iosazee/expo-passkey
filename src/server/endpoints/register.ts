/**
 * @file Register passkey endpoint
 * @description WebAuthn-based implementation for passkey registration
 */

import { createAuthEndpoint } from "better-auth/api";
import { APIError } from "better-call";
import {
  verifyRegistrationResponse,
  type VerifyRegistrationResponseOpts,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { ERROR_CODES, ERROR_MESSAGES } from "../../types/errors";
import type { Logger } from "../utils/logger";
import { registerPasskeySchema } from "../utils/schema";
import type { MobilePasskey, PasskeyChallenge } from "../../types/server";

/**
 * Create WebAuthn passkey registration endpoint
 */
export const createRegisterEndpoint = (options: {
  rpName: string;
  rpId: string;
  origin?: string | string[];
  logger: Logger;
}) => {
  const { rpName, rpId, origin, logger } = options;

  // Convert to array of origins for consistency, or use empty array if undefined
  const expectedOrigins = origin
    ? Array.isArray(origin)
      ? origin
      : [origin]
    : [];

  return createAuthEndpoint(
    "/expo-passkey/register",
    {
      method: "POST",
      body: registerPasskeySchema,
      metadata: {
        openapi: {
          description: "Register a new passkey using WebAuthn",
          tags: ["Authentication"],
          responses: {
            200: {
              description: "Passkey successfully registered",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      rpName: { type: "string" },
                      rpId: { type: "string" },
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
      const { userId, credential, platform, metadata } = ctx.body;

      try {
        logger.debug("WebAuthn registration attempt:", {
          userId,
          credentialId: credential.id,
          platform,
        });

        // Verify user exists
        const user = await ctx.context.adapter.findOne({
          model: "user",
          where: [{ field: "id", operator: "eq", value: userId }],
        });

        if (!user) {
          logger.warn("Registration failed: User not found", { userId });
          throw new APIError("BAD_REQUEST", {
            code: ERROR_CODES.SERVER.USER_NOT_FOUND,
            message: ERROR_MESSAGES[ERROR_CODES.SERVER.USER_NOT_FOUND],
          });
        }

        // Get latest challenge for this user
        const challenges = await ctx.context.adapter.findMany<PasskeyChallenge>(
          {
            model: "passkeyChallenge",
            where: [
              { field: "userId", operator: "eq", value: userId },
              { field: "type", operator: "eq", value: "registration" },
            ],
            sortBy: { field: "createdAt", direction: "desc" },
            limit: 1,
          },
        );

        const storedChallenge = challenges[0];

        if (!storedChallenge) {
          logger.warn("Registration failed: No challenge found", { userId });
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_CHALLENGE",
            message: "No challenge found for registration",
          });
        }

        // Check if challenge has expired
        if (new Date(storedChallenge.expiresAt) < new Date()) {
          logger.warn("Registration failed: Challenge expired", { userId });
          throw new APIError("BAD_REQUEST", {
            code: "EXPIRED_CHALLENGE",
            message: "Challenge has expired. Please request a new one.",
          });
        }

        // Prepare credential for verification (ensuring correct casting)
        const verifiableCredential =
          credential as unknown as RegistrationResponseJSON;

        try {
          // Create verification options
          const verificationOptions: VerifyRegistrationResponseOpts = {
            response: verifiableCredential,
            expectedChallenge: storedChallenge.challenge,
            expectedOrigin: expectedOrigins,
            expectedRPID: rpId,
            requireUserVerification: true,
          };

          // Verify the registration response
          const verification =
            await verifyRegistrationResponse(verificationOptions);

          if (!verification.verified || !verification.registrationInfo) {
            throw new Error("Verification failed");
          }

          // Extract credential information from the WebAuthnCredential object
          const { credential: webAuthnCredential, aaguid } =
            verification.registrationInfo;

          // Use credential data directly or convert as needed
          const credentialIdStr =
            typeof webAuthnCredential.id === "string"
              ? webAuthnCredential.id
              : isoBase64URL.fromBuffer(webAuthnCredential.id);

          const publicKeyStr =
            typeof webAuthnCredential.publicKey === "string"
              ? webAuthnCredential.publicKey
              : isoBase64URL.fromBuffer(webAuthnCredential.publicKey);

          const aaguidStr = aaguid
            ? typeof aaguid === "string"
              ? aaguid
              : Buffer.from(aaguid).toString("base64")
            : null;

          // Check if credential already exists
          const existingCredentials =
            await ctx.context.adapter.findMany<MobilePasskey>({
              model: "mobilePasskey",
              where: [
                {
                  field: "credentialId",
                  operator: "eq",
                  value: credentialIdStr,
                },
              ],
              limit: 1,
            });

          const existingCredential =
            existingCredentials.length > 0 ? existingCredentials[0] : null;

          const now = new Date().toISOString();

          if (existingCredential) {
            // If the existing credential is already active, throw error
            if (existingCredential.status === "active") {
              logger.warn("Registration failed: Credential already exists", {
                credentialId: credentialIdStr,
              });
              throw new APIError("BAD_REQUEST", {
                code: ERROR_CODES.SERVER.CREDENTIAL_EXISTS,
                message: ERROR_MESSAGES[ERROR_CODES.SERVER.CREDENTIAL_EXISTS],
              });
            }

            // Update the existing revoked credential
            logger.info("Reactivating previously revoked passkey", {
              credentialId: credentialIdStr,
              previousStatus: existingCredential.status,
            });

            await ctx.context.adapter.update({
              model: "mobilePasskey",
              where: [
                { field: "id", operator: "eq", value: existingCredential.id },
              ],
              update: {
                userId,
                platform,
                lastUsed: now,
                status: "active",
                updatedAt: now,
                publicKey: publicKeyStr,
                counter: 0,
                aaguid: aaguidStr,
                revokedAt: null,
                revokedReason: null,
                metadata: metadata ? JSON.stringify(metadata) : "{}",
              },
            });
          } else {
            // Create new passkey record if one doesn't exist
            await ctx.context.adapter.create({
              model: "mobilePasskey",
              data: {
                id: ctx.context.generateId({
                  model: "mobilePasskey",
                  size: 32,
                }),
                userId,
                credentialId: credentialIdStr,
                publicKey: publicKeyStr,
                counter: 0,
                platform,
                aaguid: aaguidStr,
                lastUsed: now,
                status: "active",
                createdAt: now,
                updatedAt: now,
                metadata: metadata ? JSON.stringify(metadata) : "{}",
              },
            });
          }

          // Delete the used challenge
          await ctx.context.adapter.delete({
            model: "passkeyChallenge",
            where: [{ field: "id", operator: "eq", value: storedChallenge.id }],
          });

          logger.info("WebAuthn passkey registration successful", {
            userId,
            credentialId: credentialIdStr,
            platform,
            isUpdate: !!existingCredential,
          });

          return ctx.json({
            success: true,
            rpName,
            rpId,
          });
        } catch (verificationError) {
          logger.error("WebAuthn verification failed:", verificationError);
          throw new APIError("BAD_REQUEST", {
            code: "VERIFICATION_FAILED",
            message:
              verificationError instanceof Error
                ? verificationError.message
                : "WebAuthn verification failed",
          });
        }
      } catch (error) {
        logger.error("Registration error:", error);
        if (error instanceof APIError) throw error;
        throw new APIError("BAD_REQUEST", {
          code: ERROR_CODES.SERVER.REGISTRATION_FAILED,
          message: ERROR_MESSAGES[ERROR_CODES.SERVER.REGISTRATION_FAILED],
        });
      }
    },
  );
};
