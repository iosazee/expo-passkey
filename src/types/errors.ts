/**
 * @file Error type definitions and constants
 * @module expo-passkey/types/errors
 */

/**
 * Error codes for the Expo Passkey plugin
 */
export const ERROR_CODES = {
  // Client-side error codes
  ENVIRONMENT: {
    NOT_SUPPORTED: "environment_not_supported",
    MODULE_NOT_FOUND: "module_not_found",
  },
  BIOMETRIC: {
    NOT_SUPPORTED: "biometric_not_supported",
    NOT_ENROLLED: "biometric_not_enrolled",
    AUTHENTICATION_FAILED: "biometric_authentication_failed",
  },
  DEVICE: {
    ID_GENERATION_FAILED: "device_id_generation_failed",
  },
  NETWORK: {
    REQUEST_FAILED: "network_request_failed",
  },
  WEBAUTHN: {
    NOT_SUPPORTED: "webauthn_not_supported",
    CANCELED: "webauthn_canceled",
    TIMEOUT: "webauthn_timeout",
    OPERATION_FAILED: "webauthn_operation_failed",
    INVALID_STATE: "webauthn_invalid_state",
    CHALLENGE_EXPIRED: "webauthn_challenge_expired",
    INVALID_RESPONSE: "webauthn_invalid_response",
    NOT_SECURE_CONTEXT: "webauthn_not_secure_context",
    INVALID_CREDENTIAL: "webauthn_invalid_credential",
    NATIVE_MODULE_ERROR: "webauthn_native_module_error",
  },

  // Server-side error codes
  SERVER: {
    CREDENTIAL_EXISTS: "device_already_registered",
    INVALID_CREDENTIAL: "invalid_credential",
    CREDENTIAL_NOT_FOUND: "credential_not_found",
    REGISTRATION_FAILED: "registration_failed",
    AUTHENTICATION_FAILED: "authentication_failed",
    REVOCATION_FAILED: "revocation_failed",
    INVALID_ORIGIN: "invalid_origin",
    INVALID_CLIENT: "invalid_client",
    PASSKEYS_RETRIEVAL_FAILED: "passkeys_retrieval_failed",
    USER_NOT_FOUND: "user_not_found",
    CHALLENGE_GENERATION_FAILED: "challenge_generation_failed",
    INVALID_CHALLENGE: "invalid_challenge",
    EXPIRED_CHALLENGE: "expired_challenge",
    VERIFICATION_FAILED: "verification_failed",
  },
} as const;

/**
 * Error messages mapped to error codes
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.ENVIRONMENT.NOT_SUPPORTED]: "Environment not supported",
  [ERROR_CODES.ENVIRONMENT.MODULE_NOT_FOUND]: "Required module not found",
  [ERROR_CODES.BIOMETRIC.NOT_SUPPORTED]:
    "Biometric authentication not supported on this device",
  [ERROR_CODES.BIOMETRIC.NOT_ENROLLED]:
    "Biometric authentication not enrolled on this device",
  [ERROR_CODES.BIOMETRIC.AUTHENTICATION_FAILED]:
    "Biometric authentication failed",
  [ERROR_CODES.DEVICE.ID_GENERATION_FAILED]: "Failed to generate device ID",
  [ERROR_CODES.NETWORK.REQUEST_FAILED]: "Network request failed",
  [ERROR_CODES.WEBAUTHN.NOT_SUPPORTED]:
    "WebAuthn is not supported on this device",
  [ERROR_CODES.WEBAUTHN.CANCELED]:
    "WebAuthn operation was canceled by the user",
  [ERROR_CODES.WEBAUTHN.TIMEOUT]: "WebAuthn operation timed out",
  [ERROR_CODES.WEBAUTHN.OPERATION_FAILED]: "WebAuthn operation failed",
  [ERROR_CODES.WEBAUTHN.INVALID_STATE]: "WebAuthn is in an invalid state",
  [ERROR_CODES.WEBAUTHN.CHALLENGE_EXPIRED]: "WebAuthn challenge has expired",
  [ERROR_CODES.WEBAUTHN.INVALID_RESPONSE]: "Invalid WebAuthn response",
  [ERROR_CODES.WEBAUTHN.NOT_SECURE_CONTEXT]:
    "WebAuthn requires a secure context (HTTPS)",
  [ERROR_CODES.WEBAUTHN.INVALID_CREDENTIAL]: "Invalid WebAuthn credential",
  [ERROR_CODES.WEBAUTHN.NATIVE_MODULE_ERROR]: "Error in WebAuthn native module",

  [ERROR_CODES.SERVER.CREDENTIAL_EXISTS]: "Device already registered",
  [ERROR_CODES.SERVER.INVALID_CREDENTIAL]: "Invalid credential",
  [ERROR_CODES.SERVER.CREDENTIAL_NOT_FOUND]: "Credential not found",
  [ERROR_CODES.SERVER.REGISTRATION_FAILED]: "Failed to register device",
  [ERROR_CODES.SERVER.AUTHENTICATION_FAILED]: "Authentication failed",
  [ERROR_CODES.SERVER.REVOCATION_FAILED]: "Failed to revoke credential",
  [ERROR_CODES.SERVER.INVALID_ORIGIN]: "Invalid origin",
  [ERROR_CODES.SERVER.INVALID_CLIENT]: "Invalid client",
  [ERROR_CODES.SERVER.PASSKEYS_RETRIEVAL_FAILED]: "Failed to retrieve passkeys",
  [ERROR_CODES.SERVER.USER_NOT_FOUND]: "User not found",
  [ERROR_CODES.SERVER.CHALLENGE_GENERATION_FAILED]:
    "Failed to generate challenge",
  [ERROR_CODES.SERVER.INVALID_CHALLENGE]: "Invalid challenge",
  [ERROR_CODES.SERVER.EXPIRED_CHALLENGE]: "Challenge has expired",
  [ERROR_CODES.SERVER.VERIFICATION_FAILED]: "WebAuthn verification failed",
} as const;

/**
 * Custom error class for passkey errors
 */
export class PasskeyError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(
      message ||
        ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] ||
        "Unknown error",
    );
    this.name = "PasskeyError";
    this.code = code;
  }
}
