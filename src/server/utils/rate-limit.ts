/**
 * @file Rate limiting configuration
 * @description Rate limiting definitions for passkey operations
 */

import type { BetterAuthPlugin } from "better-auth/types";

/**
 * Rate limit configuration type from Better Auth plugin
 */
type RateLimitConfig = NonNullable<BetterAuthPlugin["rateLimit"]>[number];

export interface RateLimitOptions {
  /**
   * Window for registration attempts in seconds
   */
  registerWindow?: number;

  /**
   * Maximum registration attempts per window
   */
  registerMax?: number;

  /**
   * Window for authentication attempts in seconds
   */
  authenticateWindow?: number;

  /**
   * Maximum authentication attempts per window
   */
  authenticateMax?: number;
}

/**
 * Creates rate limiting configuration for the passkey plugin
 */
export const createRateLimits = (
  options: RateLimitOptions = {},
): RateLimitConfig[] => {
  const opts = {
    registerWindow: options.registerWindow || 300,
    registerMax: options.registerMax || 3,
    authenticateWindow: options.authenticateWindow || 60,
    authenticateMax: options.authenticateMax || 5,
  };

  return [
    // Rate limit for registration endpoint
    {
      pathMatcher: (path: string) => path === "/expo-passkey/register",
      window: opts.registerWindow,
      max: opts.registerMax,
    },

    // Rate limit for authentication endpoint
    {
      pathMatcher: (path: string) => path === "/expo-passkey/authenticate",
      window: opts.authenticateWindow,
      max: opts.authenticateMax,
    },

    // Global rate limit for all passkey endpoints
    {
      pathMatcher: (path: string) => path.startsWith("/expo-passkey/"),
      window: 60,
      max: 30,
    },
  ];
};
