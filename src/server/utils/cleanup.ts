/**
 * @file Cleanup utility for outdated passkeys
 * @description Handles cleanup of inactive passkeys
 */

import type { AuthContext } from "better-auth/types";

import type { Logger } from "./logger";

export interface CleanupOptions {
  /**
   * Number of days after which inactive passkeys are revoked
   */
  inactiveDays?: number;

  /**
   * Disable the interval for automatically cleaning up inactive passkeys.
   * Set to true for serverless environments.
   * When true, cleanup will still run once on startup but not continuously.
   */
  disableInterval?: boolean;
}

/**
 * Initializes the cleanup job for inactive passkeys
 */
export const setupCleanupJob = (
  ctx: AuthContext,
  options: CleanupOptions = {},
  logger: Logger,
) => {
  const inactiveDays = options.inactiveDays ?? 30;
  const disableInterval = options.disableInterval ?? false;

  // Skip setup if inactive days is 0 or negative
  if (inactiveDays <= 0) {
    return;
  }

  const performCleanup = async () => {
    // Safety check to ensure adapter is available and properly initialized
    if (!ctx.adapter || typeof ctx.adapter.updateMany !== "function") {
      logger.warn("Skipping cleanup: Database adapter not fully initialized");
      return;
    }

    const inactiveCutoff = new Date();
    inactiveCutoff.setDate(inactiveCutoff.getDate() - inactiveDays);

    try {
      const result = await ctx.adapter.updateMany({
        model: "mobilePasskey",
        where: [
          {
            field: "lastUsed",
            operator: "lt",
            value: inactiveCutoff.toISOString(),
          },
          { field: "status", operator: "eq", value: "active" },
        ],
        update: {
          status: "revoked",
          revokedAt: new Date().toISOString(),
          revokedReason: "automatic_inactive",
          updatedAt: new Date().toISOString(),
        },
      });

      if (process.env.NODE_ENV !== "production") {
        logger.info(`Cleaned up ${result} inactive passkeys`);
      }
    } catch (error) {
      logger.error("Cleanup job failed:", error);
    }
  };

  if (disableInterval) {
    logger.debug("Cleanup interval disabled, skipping all cleanup operations");
    return null;
  }

  // Run initial cleanup with proper error handling
  performCleanup().catch((err) => {
    logger.error("Failed to run initial cleanup:", err);
    // We intentionally don't re-throw to avoid breaking initialization
  });

  // Set up interval (daily) if not disabled
  if (!disableInterval) {
    return setInterval(performCleanup, 24 * 60 * 60 * 1000);
  }

  // Return null if interval is disabled
  return null;
};
