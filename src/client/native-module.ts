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
 * Module-level cache for native passkey support check.
 * Device capabilities don't change during a session, so we only
 * need to call the native module once.
 */
let cachedIsSupported: boolean | null = null;

/**
 * Check if passkeys are supported on this device via the native module.
 * Result is cached after the first call to avoid redundant native bridge calls.
 */
export function isNativePasskeySupported(): boolean {
  if (cachedIsSupported !== null) {
    return cachedIsSupported;
  }

  try {
    cachedIsSupported = ExpoPasskeyModule.isPasskeySupported();
    return cachedIsSupported;
  } catch (error) {
    console.error(
      "[ExpoPasskey] Error checking native passkey support:",
      error,
    );
    cachedIsSupported = false;
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
    // Log the first part of the request to help with debugging
    // const requestPreview =
    //   options.requestJson.length > 200
    //     ? options.requestJson.substring(0, 200) + "..."
    //     : options.requestJson;
    // console.debug("[ExpoPasskey] Request preview:", requestPreview);
    const credentialJSON = await ExpoPasskeyModule.createPasskey(options);
    return JSON.parse(credentialJSON);
  } catch (error) {
    // Error message based on platform
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
    // Error message based on platform
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
