/**
 * @file Module loader for Expo dependencies
 * @module expo-passkey/client/utils/modules
 */

import {
  requireOptionalNativeModule,
  UnavailabilityError,
} from "expo-modules-core";

// Interface for the loaded modules
export interface ExpoModules {
  Platform: typeof import("react-native").Platform;
  Application: typeof import("expo-application");
  Device: typeof import("expo-device");
  LocalAuthentication: typeof import("expo-local-authentication");
  SecureStore: typeof import("expo-secure-store");
  Crypto: typeof import("expo-crypto");
}

import type {
  NativeRegistrationOptions,
  NativeAuthenticationOptions,
} from "../../types";

// Native module interface
export interface ExpoNativeModules {
  ExpoPasskey: {
    isPasskeySupported(): boolean;
    createPasskey(options: NativeRegistrationOptions): Promise<string>;
    authenticateWithPasskey(
      options: NativeAuthenticationOptions,
    ): Promise<string>;
  } | null;
}

// Cache loaded modules to avoid repeated require calls
let standardModules: ExpoModules | null = null;
let nativeModules: ExpoNativeModules | null = null;

/**
 * Loads all required Expo modules
 * @returns Object containing all required modules
 * @throws Error if running in a server environment
 */
export function loadExpoModules(): ExpoModules {
  // Return cached modules if available
  if (standardModules) {
    return standardModules;
  }

  // Check if running in a server environment
  if (typeof window === "undefined" && typeof process !== "undefined") {
    throw new Error("Expo modules cannot be loaded in a server environment");
  }

  try {
    standardModules = {
      Platform: require("react-native").Platform,
      Application: require("expo-application"),
      Device: require("expo-device"),
      LocalAuthentication: require("expo-local-authentication"),
      SecureStore: require("expo-secure-store"),
      Crypto: require("expo-crypto"),
    };

    return standardModules;
  } catch (error) {
    console.error("Failed to load Expo modules:", error);
    throw new Error(
      `Failed to load Expo modules: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Loads native modules required by Expo Passkey
 * @returns Object containing native modules
 */
export function loadExpoNativeModules(): ExpoNativeModules {
  // Return cached modules if available
  if (nativeModules) {
    return nativeModules;
  }

  // Check if running in a server environment
  if (typeof window === "undefined" && typeof process !== "undefined") {
    console.warn("Native modules cannot be loaded in a server environment");
    return { ExpoPasskey: null };
  }

  try {
    const { Platform } = loadExpoModules();

    // First check for platform compatibility to avoid unnecessary warnings
    if (Platform.OS === "ios") {
      const version = parseInt(Platform.Version as string, 10);
      if (isNaN(version) || version < 16) {
        console.debug(
          "[ExpoPasskey] iOS version too low for native passkey module",
        );
        return { ExpoPasskey: null };
      }
    } else if (Platform.OS === "android") {
      const apiLevel = Platform.Version as number;
      if (apiLevel < 28) {
        console.debug(
          "[ExpoPasskey] Android API level too low for native passkey module",
        );
        return { ExpoPasskey: null };
      }
    }

    // Try to load the native module
    try {
      const ExpoPasskey = requireOptionalNativeModule("ExpoPasskey");

      // Log module availability for debugging
      if (ExpoPasskey) {
        console.debug(
          `[ExpoPasskey] Native module loaded successfully with methods: ${Object.keys(ExpoPasskey).join(", ")}`,
        );
      } else {
        console.warn("[ExpoPasskey] Native module not found");
      }

      nativeModules = { ExpoPasskey };
      return nativeModules;
    } catch (e) {
      if (e instanceof UnavailabilityError) {
        console.warn(`[ExpoPasskey] Native module unavailable: ${e.message}`);
      } else {
        console.error("[ExpoPasskey] Error loading native module:", e);
      }

      nativeModules = { ExpoPasskey: null };
      return nativeModules;
    }
  } catch (error) {
    console.error("Failed to load native modules:", error);
    return { ExpoPasskey: null };
  }
}
