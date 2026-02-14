/**
 * @file Device information and credential management utilities
 * @module expo-passkey/client/utils/device
 */

import type { DeviceInfo, ExpoPasskeyClientOptions } from "../../types";
import { ERROR_CODES, PasskeyError } from "../../types/errors";

import { checkBiometricSupport } from "./biometrics";
import { loadExpoModules } from "./modules";
import {
  getStorageKeys,
  getCredentialMetadata,
  getUserCredentialIds,
} from "./storage";
import { isNativePasskeySupported } from "../native-module";

// Helper function to get modules only when needed
function getModules() {
  return loadExpoModules();
}

/**
 * Gets or generates a device identifier
 * This is used for device identification, but not directly related to WebAuthn credentials
 *
 * @param options Client options with storage prefix
 * @param generateIfMissing If true, will generate and store a new ID if none exists
 * @returns Promise resolving to a device ID or null if not found and generation is disabled
 * @throws {PasskeyError} If device ID generation fails
 */
export async function getDeviceId(
  options: ExpoPasskeyClientOptions = {},
  generateIfMissing: boolean = true,
): Promise<string | null> {
  try {
    const { Platform, Application, Device, SecureStore } = getModules();
    const KEYS = getStorageKeys(options);

    // First try to get from secure storage
    try {
      const storedId = await SecureStore.getItemAsync(KEYS.DEVICE_ID);
      if (storedId) {
        return storedId;
      }

      // If we don't want to generate a new ID, return null
      if (!generateIfMissing) {
        return null;
      }
    } catch (storageError) {
      console.warn(
        "[ExpoPasskey] Failed to retrieve stored device ID:",
        storageError,
      );
      // Continue to generate a new ID if allowed
      if (!generateIfMissing) {
        return null;
      }
    }

    let deviceId: string;

    // Platform-specific ID generation
    if (Platform.OS === "ios") {
      try {
        const iosId = await Application.getIosIdForVendorAsync();
        if (iosId) {
          deviceId = iosId;
        } else {
          deviceId = await generateFallbackDeviceId();
        }
      } catch (iosError) {
        console.warn("[ExpoPasskey] Failed to get iOS vendor ID:", iosError);
        deviceId = await generateFallbackDeviceId();
      }
    } else if (Platform.OS === "android") {
      try {
        const androidId = Application.getAndroidId();
        if (!androidId) {
          throw new Error("Android ID is empty or null");
        }
        deviceId = androidId;
      } catch (androidIdError) {
        console.warn("[ExpoPasskey] Failed to get Android ID:", androidIdError);

        // Fallback to stored unique ID if getAndroidId fails
        const androidUniqueIdKey = `${options.storagePrefix || "_better-auth"}.ANDROID_UNIQUE_ID`;
        try {
          const androidUniqueId =
            await SecureStore.getItemAsync(androidUniqueIdKey);
          if (androidUniqueId) {
            deviceId = androidUniqueId;
          } else {
            throw new Error("No stored Android unique ID");
          }
        } catch (uniqueIdError) {
          console.warn(
            "[ExpoPasskey] Failed to get stored Android unique ID:",
            uniqueIdError,
          );

          // Generate a fallback ID
          try {
            const randomId = await generateFallbackDeviceId();

            // Add device-specific information
            const deviceInfo = {
              brand: Device.brand || "",
              modelName: Device.modelName || "",
              osBuildId: Device.osBuildId || "",
            };

            // Combine random ID with device info
            const infoString = Object.values(deviceInfo)
              .filter(Boolean)
              .join("-");
            deviceId = infoString ? `${randomId}-${infoString}` : randomId;

            // Save for future use
            try {
              await SecureStore.setItemAsync(androidUniqueIdKey, deviceId);
            } catch (saveError) {
              console.warn(
                "[ExpoPasskey] Failed to save Android unique ID:",
                saveError,
              );
              // Continue anyway - we have a valid ID
            }
          } catch (fallbackError) {
            console.error(
              "[ExpoPasskey] Failed to generate fallback Android ID:",
              fallbackError,
            );
            // Last resort - use a timestamp-based ID
            deviceId = `android-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
          }
        }
      }
    } else {
      // For unsupported platforms, use fallback
      try {
        deviceId = await generateFallbackDeviceId();
      } catch (fallbackError) {
        console.error(
          "[ExpoPasskey] Failed to generate fallback ID for unsupported platform:",
          fallbackError,
        );
        // Last resort - use a timestamp-based ID
        deviceId = `${Platform.OS || "unknown"}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      }
    }

    // Store the ID for future use
    try {
      await SecureStore.setItemAsync(KEYS.DEVICE_ID, deviceId);
    } catch (saveError) {
      console.warn("[ExpoPasskey] Failed to save device ID:", saveError);
      // Continue anyway - we have a valid ID
    }

    return deviceId;
  } catch (error) {
    console.error("[ExpoPasskey] Unexpected error in getDeviceId:", error);

    if (!generateIfMissing) {
      return null;
    }

    try {
      const randomId = await generateFallbackDeviceId();
      return randomId;
    } catch (fallbackError) {
      console.error(
        "[ExpoPasskey] Failed to generate fallback ID after catastrophic error:",
        fallbackError,
      );
      // Ultimate fallback - simple timestamp + random
      return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
  }
}

/**
 * Checks if this device has any registered passkeys by looking
 * at the credential metadata stored locally
 *
 * @param options Client options with storage prefix
 * @returns Promise resolving to boolean indicating if any passkeys are registered
 */
export async function hasPasskeysRegistered(
  options: ExpoPasskeyClientOptions = {},
): Promise<boolean> {
  try {
    const credentials = await getCredentialMetadata(options);
    return Object.keys(credentials).length > 0;
  } catch (error) {
    console.error(
      "[ExpoPasskey] Error checking for registered passkeys:",
      error,
    );
    return false;
  }
}

/**
 * Checks if a specific user has registered passkeys on this device
 *
 * @param userId The user ID to check
 * @param options Client options with storage prefix
 * @returns Promise resolving to boolean indicating if user has passkeys
 */
export async function hasUserPasskeysRegistered(
  userId: string,
  options: ExpoPasskeyClientOptions = {},
): Promise<boolean> {
  try {
    const credentialIds = await getUserCredentialIds(userId, options);
    return credentialIds.length > 0;
  } catch (error) {
    console.error("[ExpoPasskey] Error checking user passkeys:", error);
    return false;
  }
}

/**
 * Checks if the device is capable of handling passkeys
 * This does not check if a passkey is registered, only if the device
 * has the hardware and software capabilities to use passkeys
 *
 * @returns Promise resolving to boolean indicating if device supports passkeys
 */
export async function isDevicePasskeyCapable(): Promise<boolean> {
  try {
    // Check if the native WebAuthn module is available and supported
    // Use the new ExpoPasskeyModule directly
    const nativeSupported = isNativePasskeySupported();

    if (!nativeSupported) {
      return false;
    }

    // Check if biometrics are set up
    const biometricInfo = await checkBiometricSupport();
    return biometricInfo.isSupported && biometricInfo.isEnrolled;
  } catch (error) {
    console.error("[ExpoPasskey] Error checking passkey capability:", error);
    return false;
  }
}

/**
 * Generates a fallback device identifier using crypto random values
 * @returns Promise resolving to a random device ID
 */
export async function generateFallbackDeviceId(): Promise<string> {
  try {
    const { Platform, Crypto } = getModules();

    try {
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      const deviceId = [...new Uint8Array(randomBytes)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `${Platform.OS}-${deviceId}`;
    } catch (cryptoError) {
      console.warn(
        "[ExpoPasskey] Failed to generate random bytes:",
        cryptoError,
      );
      // Fallback to Math.random if crypto fails
      const randomParts = [];
      for (let i = 0; i < 16; i++) {
        randomParts.push(
          Math.floor(Math.random() * 256)
            .toString(16)
            .padStart(2, "0"),
        );
      }
      return `${Platform.OS}-${randomParts.join("")}`;
    }
  } catch (error) {
    console.error(
      "[ExpoPasskey] Failed to generate fallback device ID:",
      error,
    );
    throw new PasskeyError(
      ERROR_CODES.DEVICE.ID_GENERATION_FAILED,
      "Failed to generate device ID",
    );
  }
}

/**
 * Clears all passkey-related storage data
 * This only clears local storage data, not the actual WebAuthn credentials
 * which are managed by the platform
 *
 * @param options Client options with storage prefix
 * @returns Promise resolving when all passkey data is cleared
 */
export async function clearPasskeyData(
  options: ExpoPasskeyClientOptions = {},
): Promise<void> {
  try {
    const { SecureStore } = getModules();
    const KEYS = getStorageKeys(options);
    const androidUniqueIdKey = `${options.storagePrefix || "_better-auth"}.ANDROID_UNIQUE_ID`;

    // Clear all passkey-related storage
    await Promise.allSettled([
      SecureStore.deleteItemAsync(KEYS.DEVICE_ID),
      SecureStore.deleteItemAsync(KEYS.USER_ID),
      SecureStore.deleteItemAsync(KEYS.STATE),
      SecureStore.deleteItemAsync(KEYS.CREDENTIAL_IDS),
      SecureStore.deleteItemAsync(androidUniqueIdKey),
    ]);

    // console.debug("[ExpoPasskey] Cleared all passkey data from secure storage");
  } catch (error) {
    console.error("[ExpoPasskey] Error clearing passkey data:", error);
  }
}

/**
 * Gets comprehensive device information including biometric and WebAuthn support
 * @param options Client options with storage prefix
 * @param generateDeviceId Whether to generate a device ID if none exists
 * @returns Promise resolving to device information
 */
export async function getDeviceInfo(
  options: ExpoPasskeyClientOptions = {},
  generateDeviceId: boolean = true,
): Promise<DeviceInfo> {
  try {
    const { Platform, Device, Application } = getModules();

    // Get device ID
    let deviceId: string;
    try {
      const id = await getDeviceId(options, generateDeviceId);
      deviceId = id || `temp-${Date.now()}`;
    } catch (deviceIdError) {
      console.error("[ExpoPasskey] Failed to get device ID:", deviceIdError);
      deviceId = `error-${Date.now()}`;
    }

    // Get biometric support info
    let biometricSupport;
    try {
      biometricSupport = await checkBiometricSupport();
    } catch (biometricError) {
      console.error(
        "[ExpoPasskey] Failed to check biometric support:",
        biometricError,
      );
      biometricSupport = {
        isSupported: false,
        isEnrolled: false,
        availableTypes: [],
        authenticationType: "None",
        error: "Failed to check biometric support",
        platformDetails: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      };
    }

    return {
      deviceId,
      platform: Platform.OS,
      model: Device.modelName,
      manufacturer: Device.manufacturer,
      osVersion: Device.osVersion || Platform.Version.toString(),
      appVersion: Application.nativeApplicationVersion || "1.0.0",
      biometricSupport,
    };
  } catch (error) {
    console.error("[ExpoPasskey] Unexpected error in getDeviceInfo:", error);
    throw new PasskeyError(
      ERROR_CODES.ENVIRONMENT.NOT_SUPPORTED,
      "Failed to retrieve device information",
    );
  }
}
