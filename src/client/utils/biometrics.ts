/**
 * @file Biometric authentication utilities
 * @module expo-passkey/client/utils/biometrics
 */

import type { AuthOptions, BiometricSupportInfo } from "../../types";
import { ERROR_CODES, PasskeyError } from "../../types/errors";
import { isSupportedPlatform } from "./environment";
import { isNativePasskeySupported } from "../native-module";
import { loadExpoModules } from "./modules";

/**
 * Checks if biometric authentication is supported and available
 * @returns Promise resolving to biometric support information
 */
export async function checkBiometricSupport(): Promise<BiometricSupportInfo> {
  try {
    const modules = loadExpoModules();
    const { LocalAuthentication, Platform, Device } = modules;

    // If LocalAuthentication module isn't available, biometrics aren't supported
    if (!LocalAuthentication) {
      return {
        isSupported: false,
        isEnrolled: false,
        availableTypes: [],
        authenticationType: "None",
        error: "LocalAuthentication module not available",
        platformDetails: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      };
    }

    const isSupported = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const availableTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();

    const platformDetails = {
      platform: Platform.OS,
      version: Platform.Version,
      apiLevel:
        Platform.OS === "android" ? Device?.platformApiLevel : undefined,
      manufacturer:
        Platform.OS === "android" ? Device?.manufacturer : undefined,
      brand: Platform.OS === "android" ? Device?.brand : undefined,
    };

    // Platform-specific validation for passkey support
    if (Platform.OS === "ios") {
      const version = parseInt(Platform.Version as string, 10);
      if (version < 16) {
        return {
          isSupported: false,
          isEnrolled: false,
          availableTypes: [],
          authenticationType: "None",
          error: "iOS 16 or higher required for passkey support",
          platformDetails,
        };
      }
    } else if (Platform.OS === "android") {
      // For passkeys, we need at least Android 10 (API 29)
      if (!platformDetails.apiLevel || platformDetails.apiLevel < 29) {
        return {
          isSupported: false,
          isEnrolled: false,
          availableTypes: [],
          authenticationType: "None",
          error: "Android 10 (API 29) or higher required for passkey support",
          platformDetails,
        };
      }
    } else {
      return {
        isSupported: false,
        isEnrolled: false,
        availableTypes: [],
        authenticationType: "None",
        error: "Unsupported platform",
        platformDetails: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      };
    }

    // Check if native WebAuthn implementation is available
    const nativePasskeySupported = await isNativePasskeySupported();
    if (!nativePasskeySupported) {
      return {
        isSupported: false,
        isEnrolled: false,
        availableTypes: [],
        authenticationType: "None",
        error: "Native passkey module not available or not supported",
        platformDetails,
      };
    }

    // Get the authenticationType using our updated function that now accepts both parameters
    const authenticationType = getBiometricType(
      availableTypes,
      LocalAuthentication,
      Platform,
    );

    return {
      isSupported: isSupported && nativePasskeySupported,
      isEnrolled,
      availableTypes,
      authenticationType,
      error: null,
      platformDetails,
    };
  } catch (error) {
    const modules = loadExpoModules();
    const { Platform } = modules;

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
 * @param providedLocalAuthentication Optional LocalAuthentication module for testing
 * @param providedPlatform Optional Platform for testing
 * @returns Human-readable biometric type
 */
export function getBiometricType(
  types: number[],
  providedLocalAuthentication?:
    | typeof import("expo-local-authentication")
    | null,
  providedPlatform?: typeof import("react-native").Platform,
): string {
  // For backward compatibility with tests
  // If providedLocalAuthentication and providedPlatform are passed, use them
  // Otherwise, try to load them from modules
  let LocalAuthentication = providedLocalAuthentication;
  let Platform = providedPlatform;

  if (!LocalAuthentication || !Platform) {
    try {
      const modules = loadExpoModules();
      if (!LocalAuthentication)
        LocalAuthentication = modules.LocalAuthentication;
      if (!Platform) Platform = modules.Platform;
    } catch (error) {
      console.warn(
        "[ExpoPasskey] Failed to load modules for getBiometricType:",
        error,
      );
      return "None";
    }
  }

  if (!LocalAuthentication) {
    return "None";
  }

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
  }

  return "Biometric";
}

/**
 * Authenticates the user with biometrics
 * Note: This is only used for compatibility with older versions or
 * when specific biometric checks are needed outside the WebAuthn flow
 *
 * @param options Authentication options like prompt message
 * @returns Promise resolving to authentication success
 * @throws {PasskeyError} If authentication fails
 */
export async function authenticateWithBiometrics(
  options: AuthOptions,
): Promise<boolean> {
  const modules = loadExpoModules();
  const { LocalAuthentication } = modules;

  if (!LocalAuthentication) {
    throw new PasskeyError(
      ERROR_CODES.BIOMETRIC.NOT_SUPPORTED,
      "LocalAuthentication module not available",
    );
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: options.promptMessage,
    cancelLabel: options.cancelLabel,
    disableDeviceFallback: options.disableDeviceFallback,
    fallbackLabel: options.fallbackLabel,
  });

  if (!result.success) {
    throw new PasskeyError(
      ERROR_CODES.BIOMETRIC.AUTHENTICATION_FAILED,
      result.error || "Authentication failed",
    );
  }

  return result.success;
}

/**
 * Checks if passkeys are supported on the current device
 * This checks both platform requirements and native module availability
 *
 * @returns Promise resolving to true if passkeys are supported
 */
export async function isPasskeySupported(): Promise<boolean> {
  try {
    const modules = loadExpoModules();
    const { Platform, Device } = modules;

    // First check if biometrics are supported and enrolled
    const biometricSupport = await checkBiometricSupport();
    if (!biometricSupport.isSupported || !biometricSupport.isEnrolled) {
      return false;
    }

    // Then check platform compatibility
    if (Platform.OS === "ios") {
      // iOS 16+ required for passkey support
      if (!isSupportedPlatform(Platform.OS, Platform.Version)) {
        return false;
      }
    } else if (Platform.OS === "android") {
      // Android 10+ (API 29+) required for passkey support
      const apiLevel = Device?.platformApiLevel;
      if (!apiLevel || !isSupportedPlatform(Platform.OS, apiLevel)) {
        return false;
      }
    } else {
      // Other platforms not supported
      return false;
    }

    // Finally, check if native WebAuthn module is available
    return isNativePasskeySupported();
  } catch (error) {
    console.error("[ExpoPasskey] Error checking passkey support:", error);
    return false;
  }
}
