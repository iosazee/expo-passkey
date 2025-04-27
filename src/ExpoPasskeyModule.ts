import { requireNativeModule } from "expo-modules-core";

/**
 * Interface for the ExpoPasskey native module
 */
export interface ExpoPasskeyInterface {
  /**
   * Check if WebAuthn/passkeys are supported on this device
   * @returns Boolean indicating if passkeys are supported
   */
  isPasskeySupported(): boolean;

  /**
   * Create a new passkey (WebAuthn credential registration)
   * @param options Options containing WebAuthn registration request as JSON
   * @returns Promise resolving to credential JSON string
   */
  createPasskey(options: { requestJson: string }): Promise<string>;

  /**
   * Authenticate with a passkey (WebAuthn credential authentication)
   * @param options Options containing WebAuthn authentication request as JSON
   * @returns Promise resolving to credential JSON string
   */
  authenticateWithPasskey(options: { requestJson: string }): Promise<string>;
}

// This call loads the native module object from the JSI or Native Modules bridge
const ExpoPasskeyModule =
  requireNativeModule<ExpoPasskeyInterface>("ExpoPasskeyModule");

export default ExpoPasskeyModule;
