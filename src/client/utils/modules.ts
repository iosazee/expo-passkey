/**
 * @file Module loader for Expo dependencies
 * @module expo-passkey/client/utils/modules
 */

import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

// Interface for the loaded modules
export interface ExpoModules {
  Platform: typeof Platform;
  Application: typeof Application;
  Device: typeof Device;
  LocalAuthentication: typeof LocalAuthentication;
  SecureStore: typeof SecureStore;
  Crypto: typeof Crypto;
}

// Return all modules bundled together
export function loadExpoModules(): ExpoModules {
  // Check if running in a server environment
  if (typeof window === "undefined" && typeof process !== "undefined") {
    throw new Error("Expo modules cannot be loaded in a server environment");
  }

  // Return the statically imported modules
  return {
    Platform,
    Application,
    Device,
    LocalAuthentication,
    SecureStore,
    Crypto,
  };
}
