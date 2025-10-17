/**
 * @file Schema definitions
 * @description Zod schema definitions for request validation
 */

import { z } from "zod";

/**
 * Schema for authenticator selection criteria
 */
const authenticatorSelectionSchema = z.object({
  authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
  residentKey: z.enum(["required", "preferred", "discouraged"]).optional(),
  requireResidentKey: z.boolean().optional(),
  userVerification: z.enum(["required", "preferred", "discouraged"]).optional(),
});

/**
 * Schema for registration options that can be passed with challenge request
 */
export const registrationOptionsSchema = z.object({
  attestation: z.enum(["none", "indirect", "direct", "enterprise"]).optional(),
  authenticatorSelection: authenticatorSelectionSchema.optional(),
  timeout: z.number().optional(),
});

// Export the registration options schema type for use in other files
export type RegistrationOptions = z.infer<typeof registrationOptionsSchema>;

/**
 * Schema for WebAuthn challenge requests
 * Note: userId is no longer accepted from client for security.
 * For registration challenges, userId is obtained from the authenticated session.
 * For authentication challenges, userId can be optionally provided or omitted for discoverable credentials.
 */
export const challengeSchema = z.object({
  type: z.enum(["registration", "authentication"]),
  userId: z.string().optional(), // Only used for authentication challenges
  registrationOptions: registrationOptionsSchema.optional(),
});

/**
 * Schema for WebAuthn passkey registration requests
 * Note: userId is obtained from the authenticated session for security.
 * Client should not provide userId.
 */
export const registerPasskeySchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      transports: z.array(z.string()).optional(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.object({}).optional(),
    authenticatorAttachment: z
      .union([z.literal("platform"), z.literal("cross-platform")])
      .optional(),
  }),
  platform: z.string(),
  metadata: z
    .object({
      deviceName: z.string().optional(),
      deviceModel: z.string().optional(),
      appVersion: z.string().optional(),
      manufacturer: z.string().optional(),
      biometricType: z.string().optional(),
      lastLocation: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for WebAuthn passkey authentication requests
 */
export const authenticatePasskeySchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.object({}).optional(),
  }),
  metadata: z
    .object({
      lastLocation: z.string().optional(),
      appVersion: z.string().optional(),
      deviceModel: z.string().optional(),
      manufacturer: z.string().optional(),
      biometricType: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for list passkeys query parameters
 */
export const listPasskeysQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

/**
 * Schema for list passkeys URL parameters
 */
export const listPasskeysParamsSchema = z.object({
  userId: z.string({
    description: "User ID to fetch passkeys for",
    required_error: "User ID is required",
  }),
});

/**
 * Schema for passkey revocation requests
 * Note: userId is obtained from the authenticated session for security.
 * Client should not provide userId.
 */
export const revokePasskeySchema = z.object({
  credentialId: z.string(),
  reason: z.string().optional(),
});
