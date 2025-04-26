/**
 * @file Logger utility
 * @description Configurable logger for the server implementation
 */

export interface LoggerOptions {
  enabled?: boolean;
  level?: "debug" | "info" | "warn" | "error";
}

export type LoggerLevel = "debug" | "info" | "warn" | "error";

/**
 * Creates a logger instance with configurable log levels
 */
export const createLogger = (options: LoggerOptions = {}) => {
  const enabled =
    options.enabled !== undefined
      ? options.enabled
      : process.env.NODE_ENV === "development";

  const opts = {
    enabled,
    level: options.level ?? "info",
  };

  // Log level priority
  const logLevels: Record<LoggerLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  // Check if a level should be logged based on the configured level
  const shouldLog = (level: LoggerLevel): boolean => {
    return opts.enabled && logLevels[level] >= logLevels[opts.level];
  };

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.debug("[ExpoPasskey]", ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) {
        console.info("[ExpoPasskey]", ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) {
        console.warn("[ExpoPasskey]", ...args);
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) {
        console.error("[ExpoPasskey]", ...args);
      }
    },
  };
};

/**
 * Logger type
 */
export type Logger = ReturnType<typeof createLogger>;
