/**
 * Types for the ExpoPasskey Native Module
 */

/**
 * Options for creating a new passkey
 */
export interface CreatePasskeyOptions {
  /**
   * WebAuthn registration options serialized as a JSON string
   */
  requestJson: string;
}

/**
 * Options for authenticating with a passkey
 */
export interface AuthenticatePasskeyOptions {
  /**
   * WebAuthn authentication options serialized as a JSON string
   */
  requestJson: string;
}

/**
 * Interface for the ExpoPasskey native module
 */
export interface ExpoPasskeyModule {
  /**
   * Check if passkeys are supported on this device
   * @returns Promise resolving to boolean indicating if passkeys are supported
   */
  isPasskeySupported(): boolean;

  /**
   * Create a new passkey (WebAuthn credential registration)
   * @param options Options for creating a passkey
   * @returns Promise resolving to credential JSON string
   */
  createPasskey(options: CreatePasskeyOptions): Promise<string>;

  /**
   * Authenticate with a passkey (WebAuthn credential authentication)
   * @param options Options for authenticating with a passkey
   * @returns Promise resolving to credential JSON string
   */
  authenticateWithPasskey(options: AuthenticatePasskeyOptions): Promise<string>;
}
