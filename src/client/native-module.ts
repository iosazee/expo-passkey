/**
 * @file Native module wrapper for Expo Passkey
 * @module expo-passkey/client/native-module
 */

import { ERROR_CODES, PasskeyError } from "../types/errors";
import type {
  AuthenticationPublicKeyCredential,
  NativeAuthenticationOptions,
  NativeRegistrationOptions,
  RegistrationPublicKeyCredential,
} from "../types";

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
  try {
    const { ExpoPasskey } = require("expo-modules-core").NativeModulesProxy;

    if (!ExpoPasskey) {
      throw new PasskeyError(
        ERROR_CODES.ENVIRONMENT.MODULE_NOT_FOUND,
        "ExpoPasskey native module not found. Make sure the module is properly installed.",
      );
    }

    return ExpoPasskey;
  } catch (error) {
    throw new PasskeyError(
      ERROR_CODES.ENVIRONMENT.MODULE_NOT_FOUND,
      error instanceof Error
        ? error.message
        : "Failed to get ExpoPasskey native module",
    );
  }
}

/**
 * Check if passkeys are supported on this device via the native module
 */
export async function isNativePasskeySupported(): Promise<boolean> {
  try {
    const nativeModule = getNativeModule();
    return nativeModule.isPasskeySupported();
  } catch (_error) {
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
    throw new PasskeyError(
      ERROR_CODES.WEBAUTHN.NATIVE_MODULE_ERROR,
      error instanceof Error
        ? error.message
        : "Failed to create passkey with native module",
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
    throw new PasskeyError(
      ERROR_CODES.WEBAUTHN.NATIVE_MODULE_ERROR,
      error instanceof Error
        ? error.message
        : "Failed to authenticate with native module",
    );
  }
}
