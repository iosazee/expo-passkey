/**
 * @file Main entry point for expo-passkey
 * @description Client-side exports for Expo Passkey authentication
 * @module expo-passkey
 */

// Export the native module
import ExpoPasskeyModule from "./ExpoPasskeyModule";
export default ExpoPasskeyModule;

// Export native module types
export * from "./ExpoPasskeyModule.types";

// Client exports only (no server imports to prevent Metro issues)
export { ERROR_CODES, PasskeyError } from "./types/errors";
export { expoPasskeyClient } from "./client";

// Re-export client-side types
export type {
  BiometricSupportInfo,
  DeviceInfo,
  PasskeyPlatform,
  PasskeyMetadata,
  PasskeyState,
  AuthOptions,
  WebAuthnSupportInfo,
} from "./types/passkey";

// Re-export WebAuthn types that might be needed by client
export type {
  AuthenticatorAttachment,
  UserVerificationRequirement,
  PublicKeyCredentialDescriptor,
} from "./types/webauthn";
