/**
 * @file Client-specific type definitions
 * @module expo-passkey/types/client
 */

import type { BetterAuthPlugin, User } from "better-auth/types";

import type { BiometricSupportInfo } from "./passkey";
import type { MobilePasskey } from "./server";

/**
 * Client options for the Expo Passkey plugin
 */
export interface ExpoPasskeyClientOptions {
  /**
   * Prefix for storage keys
   * @default '_better-auth'
   */
  storagePrefix?: string;
}

/**
 * Storage keys used by the plugin
 */
export interface StorageKeys {
  DEVICE_ID: string;
  STATE: string;
  USER_ID: string;
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
  passkeys: MobilePasskey[];
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
  deviceId: string | null;
  biometricSupport: BiometricSupportInfo | null;
  error: Error | null;
}

/**
 * Server plugin definition for type inference
 */
export type ExpoPasskeyServerPlugin = BetterAuthPlugin & {
  id: "expo-passkey";
  endpoints: {
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
