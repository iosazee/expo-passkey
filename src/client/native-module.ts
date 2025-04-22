/**
 * @file Native module wrapper for Expo Passkey
 * @module expo-passkey/client/native-module
 */

import { Platform } from "react-native";
import { ERROR_CODES, PasskeyError } from "../types/errors";
import type {
  AuthenticationPublicKeyCredential,
  NativeAuthenticationOptions,
  NativeRegistrationOptions,
  RegistrationPublicKeyCredential,
} from "../types";
import { loadExpoNativeModules } from "./utils/modules";

/**
 * Interface for the ExpoPasskey native module
 */
interface ExpoPasskeyModule {
  /**
   * Check if WebAuthn/passkeys are supported on this device
   */
  isPasskeySupported(): boolean;

  /**
   * Create a new passkey (WebAuthn credential registration)
   */
  createPasskey(options: NativeRegistrationOptions): Promise<string>;

  /**
   * Authenticate with a passkey (WebAuthn credential authentication)
   */
  authenticateWithPasskey(
    options: NativeAuthenticationOptions,
  ): Promise<string>;
}

/**
 * Gets the ExpoPasskey native module
 * @returns The ExpoPasskey native module
 * @throws PasskeyError if the module is not available
 */
export function getNativeModule(): ExpoPasskeyModule {
  const { ExpoPasskey } = loadExpoNativeModules();

  if (!ExpoPasskey) {
    console.warn(
      "[ExpoPasskey] Native module not found through loadExpoNativeModules. " +
        "This may indicate the module is not properly linked.",
    );
    throw new PasskeyError(
      ERROR_CODES.ENVIRONMENT.MODULE_NOT_FOUND,
      "ExpoPasskey native module not found. Make sure the module is properly installed and linked.",
    );
  }

  return ExpoPasskey;
}

/**
 * Check if passkeys are supported on this device via the native module
 * Enhanced with better error handling and debug logging
 */
export async function isNativePasskeySupported(): Promise<boolean> {
  try {
    const { ExpoPasskey } = loadExpoNativeModules();

    // If the module couldn't be loaded, passkeys aren't supported
    if (!ExpoPasskey) {
      console.debug(
        "[ExpoPasskey] Native module not available, passkeys not supported",
      );
      return false;
    }

    // Call the native method and log the result
    const result = ExpoPasskey.isPasskeySupported();
    console.debug(
      `[ExpoPasskey] Native module isPasskeySupported() returned: ${result}`,
    );

    return result;
  } catch (error) {
    console.error(
      "[ExpoPasskey] Error checking native passkey support:",
      error,
    );

    // Log additional information for debugging
    if (error instanceof Error) {
      console.error("[ExpoPasskey] Error message:", error.message);
      console.error("[ExpoPasskey] Error stack:", error.stack);
    }

    return false;
  }
}

/**
 * Create a passkey using the native module
 * @param options WebAuthn registration options as JSON string
 * @returns Promise resolving to the credential
 */
export async function createNativePasskey(
  options: NativeRegistrationOptions,
): Promise<RegistrationPublicKeyCredential> {
  try {
    const nativeModule = getNativeModule();
    const credentialJSON = await nativeModule.createPasskey(options);

    return JSON.parse(credentialJSON);
  } catch (error) {
    // Enhance error message based on platform
    const platformHint =
      Platform.OS === "ios"
        ? "Ensure iOS 16+ and ExpoPasskey pod is properly installed."
        : "Ensure Android API 28+ and credentials-play-services-auth dependency is properly set up.";

    throw new PasskeyError(
      ERROR_CODES.WEBAUTHN.NATIVE_MODULE_ERROR,
      error instanceof Error
        ? `Failed to create passkey: ${error.message}. ${platformHint}`
        : `Failed to create passkey. ${platformHint}`,
    );
  }
}

/**
 * Authenticate with a passkey using the native module
 * @param options WebAuthn authentication options as JSON string
 * @returns Promise resolving to the credential
 */
export async function authenticateWithNativePasskey(
  options: NativeAuthenticationOptions,
): Promise<AuthenticationPublicKeyCredential> {
  try {
    const nativeModule = getNativeModule();
    const credentialJSON = await nativeModule.authenticateWithPasskey(options);

    return JSON.parse(credentialJSON);
  } catch (error) {
    // Enhance error message based on platform
    const platformHint =
      Platform.OS === "ios"
        ? "Ensure iOS 16+ and ExpoPasskey pod is properly installed."
        : "Ensure Android API 28+ and credentials-play-services-auth dependency is properly set up.";

    throw new PasskeyError(
      ERROR_CODES.WEBAUTHN.NATIVE_MODULE_ERROR,
      error instanceof Error
        ? `Failed to authenticate with passkey: ${error.message}. ${platformHint}`
        : `Failed to authenticate with passkey. ${platformHint}`,
    );
  }
}
