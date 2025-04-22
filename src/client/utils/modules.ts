/**
 * @file Module loader for Expo dependencies
 * @module expo-passkey/client/utils/modules
 */

// Interface for the loaded modules
export interface ExpoModules {
  Platform: typeof import("react-native").Platform;
  Application: typeof import("expo-application") | null;
  Device: typeof import("expo-device") | null;
  LocalAuthentication: typeof import("expo-local-authentication") | null;
  SecureStore: typeof import("expo-secure-store") | null;
  Crypto: typeof import("expo-crypto") | null;
}

// Cache for loaded modules to avoid repeated require attempts
let cachedModules: ExpoModules | null = null;

/**
 * Safely requires a module and returns null if it fails
 * @param moduleName The name of the module to require
 * @returns The module or null if it fails to load
 */
function safeRequire<T>(moduleName: string): T | null {
  try {
    return require(moduleName) as T;
  } catch (error) {
    console.warn(`[ExpoPasskey] Failed to load module "${moduleName}":`, error);
    return null;
  }
}

/**
 * Loads all required Expo modules with error handling
 * @returns Object containing all required modules (some may be null if loading failed)
 */
export function loadExpoModules(): ExpoModules {
  // Return cached modules if available
  if (cachedModules) {
    return cachedModules;
  }

  // Check if running in a server environment
  if (typeof window === "undefined" && typeof process !== "undefined") {
    throw new Error("Expo modules cannot be loaded in a server environment");
  }

  // Load React Native Platform (this is the most essential dependency)
  let Platform;
  try {
    Platform = require("react-native").Platform;
  } catch (error) {
    console.error("[ExpoPasskey] Failed to load React Native Platform:", error);
    throw new Error(
      "Failed to load React Native Platform. This is a critical dependency.",
    );
  }

  // Safely load other modules
  const modules: ExpoModules = {
    Platform,
    Application:
      safeRequire<typeof import("expo-application")>("expo-application"),
    Device: safeRequire<typeof import("expo-device")>("expo-device"),
    LocalAuthentication: safeRequire<
      typeof import("expo-local-authentication")
    >("expo-local-authentication"),
    SecureStore:
      safeRequire<typeof import("expo-secure-store")>("expo-secure-store"),
    Crypto: safeRequire<typeof import("expo-crypto")>("expo-crypto"),
  };

  // Cache the modules
  cachedModules = modules;

  return modules;
}

/**
 * Check if all critical modules are available
 * @returns True if all critical modules are loaded
 */
export function areModulesAvailable(): boolean {
  const modules = loadExpoModules();
  return !!(
    modules.Platform &&
    modules.SecureStore &&
    modules.LocalAuthentication
  );
}

/**
 * Gets SecureStore module with proper error handling
 * @returns The SecureStore module or throws an error if unavailable
 */
export function getSecureStore(): typeof import("expo-secure-store") {
  const modules = loadExpoModules();
  if (!modules.SecureStore) {
    throw new Error(
      "[ExpoPasskey] SecureStore module is required but not available",
    );
  }
  return modules.SecureStore;
}
