/**
 * @file Server-specific type definitions
 * @module expo-passkey/types/server
 */

import { z } from 'zod';

/**
 * Configuration options for the Expo Passkey server plugin
 */
export interface ExpoPasskeyOptions {
  /** Relying Party Name for the passkey */
  rpName: string;
  /** Relying Party ID for the passkey */
  rpId: string;
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
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * Database schema for the mobilePasskey model
 */
export const mobilePasskeySchema = z.object({
  id: z.string(),
  userId: z.string(),
  deviceId: z.string(),
  platform: z.string(),
  lastUsed: z.string(),
  status: z.enum(['active', 'revoked']).default('active'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  revokedAt: z.string().optional(),
  revokedReason: z.string().optional(),
  metadata: z.string().optional(),
});

/** MobilePasskey model  */
export type MobilePasskey = z.infer<typeof mobilePasskeySchema>;
