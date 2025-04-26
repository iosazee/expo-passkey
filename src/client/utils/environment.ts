/**
 * @file Environment detection utilities
 * @module expo-passkey/utils/environment
 */

/**
 * Checks if the device platform is supported for passkeys
 * @param platform The platform to check
 * @param version The platform version
 * @returns True if the platform and version are supported
 */
export function isSupportedPlatform(
  platform: string,
  version: string | number,
): boolean {
  if (platform === "ios") {
    if (typeof version === "string") {
      // Make sure the version string contains only digits and decimal points
      if (!/^[0-9.]+$/.test(version)) {
        return false;
      }
      const iosVersion = parseInt(version, 10);
      return !isNaN(iosVersion) && iosVersion >= 16;
    }
    return typeof version === "number" && !isNaN(version) && version >= 16;
  }

  if (platform === "android") {
    // Android API level 28+ (Android 9+) according to Google's documentation
    if (typeof version === "number") {
      return version >= 28;
    }

    // If version is a string, try to parse it
    if (typeof version === "string") {
      try {
        // First, check if it's a direct API level
        const apiLevel = parseInt(version, 10);
        if (!isNaN(apiLevel)) {
          return apiLevel >= 28;
        }

        // If not, check if it's a version string (e.g. "9.0.0")
        const major = parseInt(version.split(".")[0], 10);
        return !isNaN(major) && major >= 9;
      } catch (_e) {
        return false;
      }
    }
  }

  return false;
}
