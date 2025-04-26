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
import ExpoPasskeyModule from "../ExpoPasskeyModule";

/**
 * Check if passkeys are supported on this device via the native module
 * Enhanced with better error handling and debug logging
 */
export async function isNativePasskeySupported(): Promise<boolean> {
  try {
    // Call the native method and log the result
    const result = ExpoPasskeyModule.isPasskeySupported();
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
    const credentialJSON = await ExpoPasskeyModule.createPasskey(options);
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
    const credentialJSON =
      await ExpoPasskeyModule.authenticateWithPasskey(options);
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
