/**
 * @file Server-specific type definitions
 * @module expo-passkey/types/server
 */

import { z } from "zod";

/**
 * Configuration options for the Expo Passkey server plugin
 */
export interface ExpoPasskeyOptions {
  /** Relying Party Name for the passkey */
  rpName: string;

  /** Relying Party ID for the passkey */
  rpId: string;

  /**
   * Expected origins for WebAuthn verification
   * For ios, this is your associated domain, for android this is the SHA-256 hash of the apk signing certificate and is in this format:
   * android:apk-key-hash:{base64url-encoded-hash}
   */
  origin?: string | string[];

  /** Rate limiting configuration */
  rateLimit?: {
    /** Window for registration attempts in seconds */
    registerWindow?: number;
    /** Maximum registration attempts per window */
    registerMax?: number;
    /** Window for authentication attempts in seconds */
    authenticateWindow?: number;
    /** Maximum authentication attempts per window */
    authenticateMax?: number;
  };

  /** Cleanup configuration for old/inactive passkeys */
  cleanup?: {
    /** Number of days after which inactive passkeys are revoked */
    inactiveDays?: number;
    /**
     * Disable the interval for automatically cleaning up inactive passkeys.
     * Set to true for serverless environments.
     * When true, cleanup will still run once on startup but not continuously.
     */
    disableInterval?: boolean;
  };

  /** Logger configuration */
  logger?: {
    enabled?: boolean;
    level?: "debug" | "info" | "warn" | "error";
  };
}

/**
 * Database schema for the authPasskey model
 */
export const authPasskeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  credentialId: z.string(),
  publicKey: z.string(),
  counter: z.number().default(0),
  platform: z.string(),
  lastUsed: z.string(),
  status: z.enum(["active", "revoked"]).default("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
  revokedAt: z.string().optional(),
  revokedReason: z.string().optional(),
  metadata: z.string().optional(),
  aaguid: z.string().optional(),
});

/**
 * Database schema for the passkeyChallenge model
 */
export const passkeyChallengeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  challenge: z.string(),
  type: z.enum(["registration", "authentication"]),
  createdAt: z.string(),
  expiresAt: z.string(),
  registrationOptions: z.string().optional(), // JSON string containing client registration preferences
});

/** AuthPasskey model type */
export type AuthPasskey = z.infer<typeof authPasskeySchema>;

/** PasskeyChallenge model type */
export type PasskeyChallenge = z.infer<typeof passkeyChallengeSchema>;
