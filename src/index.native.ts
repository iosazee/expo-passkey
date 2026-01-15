/**
 * @file Native/mobile entry point for Expo Passkey client
 * @description Client-side exports for Expo Passkey authentication
 * @module expo-passkey
 */

// Export the native module
import ExpoPasskeyModule from "./ExpoPasskeyModule";
export default ExpoPasskeyModule;

// Export native module types
export * from "./ExpoPasskeyModule.types";

// Client exports only
export { ERROR_CODES, PasskeyError } from "./types/errors";
export { expoPasskeyClient } from "./client/index.native";

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

// Export diagnostic utilities
export {
  runPasskeyDiagnostics,
  isPasskeyReady,
} from "./client/utils/diagnostics.native";
