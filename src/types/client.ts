/**
 * @file Client-specific type definitions
 * @module expo-passkey/types/client
 */

import type { BetterAuthPlugin, User } from "better-auth/types";

import type { BiometricSupportInfo } from "./passkey";

/**
 * Client options for the Expo Passkey plugin
 */
export interface ExpoPasskeyClientOptions {
  /**
   * Prefix for storage keys
   * @default '_better-auth'
   */
  storagePrefix?: string;

  /**
   * Timeout for WebAuthn operations in milliseconds
   * @default 60000 (1 minute)
   */
  timeout?: number;
}

/**
 * Storage keys used by the plugin
 */
export interface StorageKeys {
  DEVICE_ID: string;
  STATE: string;
  USER_ID: string;
  CREDENTIAL_IDS: string;
}

/**
 * Challenge response from the server
 */
export interface ChallengeResponse {
  challenge: string;
}

/**
 * Response from registration endpoint
 */
export interface RegisterPasskeySuccessResponse {
  success: boolean;
  rpName: string;
  rpId: string;
}

/**
 * Basic error type that Better Fetch returns
 */
export interface FetchError {
  status: number;
  statusText: string;
  message?: string;
}

/**
 * Native module registration options
 */
export interface NativeRegistrationOptions {
  requestJson: string;
}

/**
 * Native module authentication options
 */
export interface NativeAuthenticationOptions {
  requestJson: string;
}

/**
 * Result object for the getChallenge function
 */
export interface ChallengeResult {
  data: ChallengeResponse | null;
  error: Error | null;
}

/**
 * Result object for the registerPasskey function
 */
export interface RegisterPasskeyResult {
  data: RegisterPasskeySuccessResponse | null;
  error: Error | null;
}

/**
 * Authentication success data
 */
export interface AuthPasskeySuccessResponse {
  token: string;
  user: User;
}

/**
 * Result object for the authenticateWithPasskey function
 */
export interface AuthenticatePasskeyResult {
  data: AuthPasskeySuccessResponse | null;
  error: Error | null;
}

/**
 * Response from listing passkeys endpoint
 */
export interface ListPasskeysSuccessResponse {
  passkeys: Array<{
    id: string;
    userId: string;
    credentialId: string;
    platform: string;
    lastUsed: string;
    status: "active" | "revoked";
    aaguid?: string;
    createdAt: string;
    updatedAt: string;
    revokedAt?: string;
    revokedReason?: string;
    metadata: Record<string, unknown>;
  }>;
  nextOffset?: number;
}

/**
 * Result object for the listPasskeys function
 */
export interface ListPasskeysResult {
  data: ListPasskeysSuccessResponse | null;
  error: Error | null;
}

/**
 * Result object for the revokePasskey function
 */
export interface RevokePasskeyResult {
  data: { success: boolean } | null;
  error: Error | null;
}

/**
 * Passkey check result
 */
export interface PasskeyRegistrationCheckResult {
  isRegistered: boolean;
  credentialIds: string[];
  biometricSupport: BiometricSupportInfo | null;
  error: Error | null;
}

/**
 * Server plugin definition for type inference
 */
export type ExpoPasskeyServerPlugin = BetterAuthPlugin & {
  id: "expo-passkey";
  endpoints: {
    passkeyChallenges: {
      path: "/expo-passkey/challenge";
      response: { data: ChallengeResponse; error?: FetchError };
    };
    registerPasskey: {
      path: "/expo-passkey/register";
      response: { data: RegisterPasskeySuccessResponse; error?: FetchError };
    };
    authenticatePasskey: {
      path: "/expo-passkey/authenticate";
      response: { data: AuthPasskeySuccessResponse; error?: FetchError };
    };
    listPasskeys: {
      path: "/expo-passkey/list/:userId";
      response: { data: ListPasskeysSuccessResponse; error?: FetchError };
    };
    revokePasskey: {
      path: "/expo-passkey/revoke";
      response: { data: { success: boolean }; error?: FetchError };
    };
  };
};
