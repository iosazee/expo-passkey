/**
 * @file Biometric authentication utilities
 * @module expo-passkey/client/utils/biometrics
 */

import type { BiometricSupportInfo } from "../../types";
import { isSupportedPlatform } from "./environment";
import { isNativePasskeySupported } from "../native-module";

import { loadExpoModules } from "./modules";

// Helper function to get modules only when needed
function getModules() {
  return loadExpoModules();
}

/**
 * Checks if biometric authentication is supported and available
 * @returns Promise resolving to biometric support information
 */
export async function checkBiometricSupport(): Promise<BiometricSupportInfo> {
  try {
    const { LocalAuthentication, Platform, Device } = getModules();

    // Get basic hardware support info
    const isSupported = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const availableTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    // Get platform details for debugging and feature detection
    const platformDetails = {
      platform: Platform.OS,
      version: Platform.Version,
      apiLevel: Platform.OS === "android" ? Device.platformApiLevel : undefined,
      manufacturer: Platform.OS === "android" ? Device.manufacturer : undefined,
      brand: Platform.OS === "android" ? Device.brand : undefined,
    };

    // console.debug("[ExpoPasskey] Platform details:", platformDetails);
    // console.debug("[ExpoPasskey] Biometric hardware support:", isSupported);
    // console.debug("[ExpoPasskey] Biometric enrollment status:", isEnrolled);
    // console.debug("[ExpoPasskey] Available auth types:", availableTypes);

    // Check if the platform meets version requirements using the utility function
    if (
      !isSupportedPlatform(
        Platform.OS,
        Platform.OS === "android"
          ? platformDetails.apiLevel || Platform.Version
          : Platform.Version,
      )
    ) {
      // console.debug(
      //   "[ExpoPasskey] Platform/version not supported:",
      //   Platform.OS,
      //   Platform.Version,
      // );
      return {
        isSupported: false,
        isEnrolled: false,
        availableTypes: [],
        authenticationType: "None",
        error:
          Platform.OS === "ios"
            ? "iOS 16 or higher required for passkey support"
            : "Android 9 (API 28) or higher required for passkey support",
        platformDetails,
      };
    }

    // Check if native WebAuthn implementation is available
    // This is the final check after platform requirements are met
    let nativePasskeySupported = false;
    try {
      // Use the ExpoPasskeyModule directly
      nativePasskeySupported = isNativePasskeySupported();
    } catch (error) {
      console.warn(
        "[ExpoPasskey] Error checking native passkey support:",
        error,
      );
      // Continue with false result
    }

    // If native module check fails, we still have incomplete information
    if (!nativePasskeySupported) {
      return {
        isSupported: false,
        isEnrolled: isEnrolled,
        availableTypes,
        authenticationType: getBiometricType(availableTypes),
        error: "Native passkey module not available or not supported",
        platformDetails,
      };
    }

    // Determine the biometric type for user-friendly display
    const authenticationType = getBiometricType(availableTypes);

    return {
      isSupported: isSupported && nativePasskeySupported,
      isEnrolled,
      availableTypes,
      authenticationType,
      error: null,
      platformDetails,
    };
  } catch (error) {
    console.error("[ExpoPasskey] Error in checkBiometricSupport:", error);
    const { Platform } = getModules();
    return {
      isSupported: false,
      isEnrolled: false,
      availableTypes: [],
      authenticationType: "None",
      error:
        error instanceof Error
          ? error.message
          : "Unknown error checking biometric support",
      platformDetails: {
        platform: Platform.OS,
        version: Platform.Version,
      },
    };
  }
}

/**
 * Determines the type of biometric authentication available
 * @param types Available authentication types
 * @returns Human-readable biometric type
 */
export function getBiometricType(types: number[]): string {
  const { LocalAuthentication, Platform } = getModules();

  if (Platform.OS === "ios") {
    return types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    )
      ? "Face ID"
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? "Touch ID"
        : "None";
  }

  if (Platform.OS === "android") {
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return "Fingerprint";
    }
    if (
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ) {
      return "Face Unlock";
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return "Iris";
    }

    // Additional check - if we have types but none match specific ones,
    // assume it's some form of biometric
    if (types.length > 0) {
      return "Biometric";
    }
  }

  return "Biometric";
}

/**
 * Checks if passkeys are supported on the current device
 * This checks both platform requirements and native module availability
 *
 * @returns Promise resolving to true if passkeys are supported
 */
export async function isPasskeySupported(): Promise<boolean> {
  try {
    const { Platform, Device } = getModules();

    // First check if biometrics are supported and enrolled
    let biometricSupport;
    try {
      biometricSupport = await checkBiometricSupport();
    } catch (error) {
      console.error("[ExpoPasskey] Error checking biometric support:", error);
      return false;
    }

    // Check for basic biometric hardware and enrollment
    if (!biometricSupport.isSupported) {
      return false;
    }

    if (!biometricSupport.isEnrolled) {
      return false;
    }

    // Check platform version requirements using the utility function
    const platformVersion =
      Platform.OS === "android"
        ? Device.platformApiLevel || Platform.Version
        : Platform.Version;

    if (!isSupportedPlatform(Platform.OS, platformVersion)) {
      return false;
    }

    // Final check: native WebAuthn module
    try {
      // Use the new ExpoPasskeyModule directly
      const nativeSupported = isNativePasskeySupported();
      return nativeSupported;
    } catch (error) {
      console.error("[ExpoPasskey] Error checking native module:", error);
      return false;
    }
  } catch (error) {
    console.error(
      "[ExpoPasskey] Unexpected error in isPasskeySupported:",
      error,
    );
    return false;
  }
}
