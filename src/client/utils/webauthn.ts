/**
 * @file WebAuthn utility functions
 * @module expo-passkey/client/utils/webauthn
 */

import { Platform } from "react-native";
import type {
  AuthenticatorSelectionCriteria,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
  WebAuthnSupportInfo,
} from "../../types";

// Store device info locally
let deviceInfo: WebAuthnSupportInfo | null = null;

/**
 * Checks if the device supports WebAuthn
 */
export function checkWebAuthnSupport(): WebAuthnSupportInfo {
  try {
    // iOS 16+ supports WebAuthn
    if (Platform.OS === "ios") {
      const version = parseInt(Platform.Version as string, 10);
      const isSupported = !isNaN(version) && version >= 16;

      return {
        isSupported,
        platformDetails: {
          platform: Platform.OS,
          version: Platform.Version,
        },
        error: isSupported ? null : "Requires iOS 16 or later",
      };
    }

    // Android API level 29+ (Android 10+) supports WebAuthn
    if (Platform.OS === "android") {
      // Try to use stored deviceInfo if available
      const apiLevel = deviceInfo?.platformDetails?.apiLevel;

      // Default to checking platform version if apiLevel is not available
      const majorVersion = Number(String(Platform.Version).split(".")[0]);

      // Android 10 is version 29
      const isSupported =
        (typeof apiLevel === "number" && apiLevel >= 29) || majorVersion >= 10;

      return {
        isSupported,
        platformDetails: {
          platform: Platform.OS,
          version: Platform.Version,
          apiLevel: apiLevel || null,
        },
        error: isSupported
          ? null
          : "Requires Android 10 (API level 29) or later",
      };
    }

    return {
      isSupported: false,
      platformDetails: {
        platform: Platform.OS,
        version: Platform.Version,
      },
      error: "Unsupported platform",
    };
  } catch (error) {
    return {
      isSupported: false,
      platformDetails: {
        platform: Platform.OS,
        version: Platform.Version,
      },
      error:
        error instanceof Error
          ? error.message
          : "Unknown error checking WebAuthn support",
    };
  }
}

/**
 * Create registration options for WebAuthn
 */
export function createRegistrationOptions(
  challenge: string,
  userId: string,
  userName: string,
  displayName: string,
  rpId: string,
  rpName: string,
  options?: {
    timeout?: number;
    attestation?: "none" | "indirect" | "direct" | "enterprise";
    authenticatorSelection?: AuthenticatorSelectionCriteria;
    excludeCredentials?: Array<{ id: string; type: "public-key" }>;
  },
): PublicKeyCredentialCreationOptions {
  // Convert userId to a byte array, then to base64url
  const userIdBuffer = new TextEncoder().encode(userId);
  const userIdBase64 = bufferToBase64url(userIdBuffer);

  // Default authenticator selection to require platform authenticator (biometric)
  const defaultAuthenticatorSelection: AuthenticatorSelectionCriteria = {
    authenticatorAttachment: "platform",
    userVerification: "required",
    residentKey: "required",
  };

  // Create options
  return {
    rp: {
      id: rpId,
      name: rpName,
    },
    user: {
      id: userIdBase64,
      name: userName,
      displayName: displayName,
    },
    challenge,
    pubKeyCredParams: [
      // ES256 (Elliptic Curve P-256 with SHA-256)
      { type: "public-key", alg: -7 },
      // RS256 (RSASSA-PKCS1-v1_5 using SHA-256)
      { type: "public-key", alg: -257 },
    ],
    timeout: options?.timeout ?? 60000, // 1 minute
    authenticatorSelection:
      options?.authenticatorSelection ?? defaultAuthenticatorSelection,
    attestation: options?.attestation ?? "none",
    excludeCredentials:
      options?.excludeCredentials?.map((cred) => ({
        type: "public-key",
        id: cred.id,
        transports: ["internal"],
      })) ?? [],
  };
}

/**
 * Create authentication options for WebAuthn
 */
export function createAuthenticationOptions(
  challenge: string,
  rpId: string,
  options?: {
    timeout?: number;
    userVerification?: "required" | "preferred" | "discouraged";
    allowCredentials?: Array<{ id: string; type: "public-key" }>;
  },
): PublicKeyCredentialRequestOptions {
  return {
    challenge,
    rpId,
    timeout: options?.timeout ?? 60000, // 1 minute
    userVerification: options?.userVerification ?? "required",
    allowCredentials:
      options?.allowCredentials?.map((cred) => ({
        type: "public-key",
        id: cred.id,
        transports: ["internal"],
      })) ?? [],
  };
}

/**
 * Convert ArrayBuffer to base64url string
 */
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";

  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }

  // Convert binary string to base64
  const base64 = btoa(str);

  // Convert base64 to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Convert base64url string to ArrayBuffer
 */
export function base64urlToBuffer(base64url: string): ArrayBuffer {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Sets the device info reference for internal use
 */
export function setDeviceInfo(info: WebAuthnSupportInfo): void {
  deviceInfo = info;
}
