/**
 * @file Core passkey type definitions
 * @module expo-passkey/types/passkey
 */

import type { AuthenticationType } from "expo-local-authentication";

import type { MobilePasskey } from "./server";

/**
 * Platform type for passkey registration
 */
export type PasskeyPlatform = "ios" | "android" | "windows" | "macos" | "web";

/**
 * Base metadata interface for passkeys
 */
export interface PasskeyMetadata {
  deviceName?: string;
  deviceModel?: string;
  appVersion?: string;
  lastLocation?: string;
  manufacturer?: string;
  brand?: string;
  biometricType?: string;
  lastAuthenticationAt?: string;
}

/**
 * Information about biometric support
 */
export interface BiometricSupportInfo {
  isSupported: boolean;
  isEnrolled: boolean;
  availableTypes: AuthenticationType[];
  authenticationType: string;
  error: string | null;
  platformDetails: {
    platform: string;
    version: string | number;
    apiLevel?: number | null;
    manufacturer?: string | null;
    brand?: string | null;
  };
}

/**
 * Device information
 */
export interface DeviceInfo {
  deviceId: string; // Added deviceId property
  platform: PasskeyPlatform;
  model: string | null;
  manufacturer: string | null;
  osVersion: string;
  appVersion: string;
  biometricSupport: BiometricSupportInfo;
}

/**
 * Passkey state used for managing passkeys in UI applications
 */
export interface PasskeyState {
  passkeys: MobilePasskey[];
  loading: boolean;
  error: string | null;
  isSupported: boolean;
}

/**
 * Authentication options for authenticateWithBiometrics function
 */
export interface AuthOptions {
  promptMessage: string;
  cancelLabel: string;
  disableDeviceFallback: boolean;
  fallbackLabel: string;
  requireConfirmation?: boolean;
}

/**
 * WebAuthn support info
 */
export interface WebAuthnSupportInfo {
  isSupported: boolean;
  platformDetails: {
    platform: string;
    version: string | number;
    apiLevel?: number | null;
  };
  error: string | null;
}
