import * as biometricsModule from "../utils/biometrics";
import {
  clearPasskeyData,
  generateFallbackDeviceId,
  getDeviceId,
  getDeviceInfo,
} from "../utils/device";
import * as modulesModule from "../utils/modules";
import * as storageModule from "../utils/storage";

// Create mock objects for the dependencies
const mockPlatform = {
  OS: "ios",
  Version: "16.0",
  select: jest.fn((obj) => obj.ios),
};

const mockApplication = {
  getIosIdForVendorAsync: jest.fn(),
  getAndroidId: jest.fn(),
  nativeApplicationVersion: "1.0.0",
};

const mockDevice = {
  modelName: "iPhone 14",
  manufacturer: "Apple",
  brand: "Apple",
  osVersion: "16.0",
  platformApiLevel: undefined,
  osBuildId: "16A5288q",
};

const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

const mockCrypto = {
  getRandomBytesAsync: jest.fn(),
};

const mockLocalAuthentication = {
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
};

const DEFAULT_STORAGE_KEYS = {
  DEVICE_ID: "_better-auth.device_id",
  STATE: "_better-auth.passkey_state",
  USER_ID: "_better-auth.user_id",
  CREDENTIAL_IDS: "_better-auth.credential_ids",
};

// Mock both loadExpoModules and getSecureStore
jest.mock("../utils/modules", () => ({
  loadExpoModules: jest.fn(),
  getSecureStore: jest.fn(),
  areModulesAvailable: jest.fn().mockReturnValue(true),
}));

// Mock the biometrics module
jest.mock("../utils/biometrics", () => ({
  checkBiometricSupport: jest.fn(),
}));

// Mock the storage module
jest.mock("../utils/storage", () => ({
  getStorageKeys: jest.fn(),
  storeCredentialId: jest.fn(),
  getCredentialMetadata: jest.fn(),
  removeCredentialId: jest.fn(),
}));

describe("Device Utilities", () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  // Reset everything before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Correctly set up console spies
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Configure module loader mock to return our mocks
    (modulesModule.loadExpoModules as jest.Mock).mockReturnValue({
      Platform: mockPlatform,
      Application: mockApplication,
      Device: mockDevice,
      SecureStore: mockSecureStore,
      Crypto: mockCrypto,
      LocalAuthentication: mockLocalAuthentication,
    });

    // Mock getSecureStore to return our mockSecureStore
    (modulesModule.getSecureStore as jest.Mock).mockReturnValue(
      mockSecureStore,
    );

    // Default biometric support configuration
    (biometricsModule.checkBiometricSupport as jest.Mock).mockResolvedValue({
      isSupported: true,
      isEnrolled: true,
      availableTypes: [2],
      authenticationType: "Face ID",
      error: null,
      platformDetails: {
        platform: "ios",
        version: "16.0",
      },
    });

    // Configure storage keys mock
    (storageModule.getStorageKeys as jest.Mock).mockReturnValue(
      DEFAULT_STORAGE_KEYS,
    );

    // Default platform configuration
    mockPlatform.OS = "ios";
    mockPlatform.Version = "16.0";
    mockPlatform.select.mockImplementation((obj) => obj.ios);

    // Reset mock behaviors to defaults
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
    mockApplication.getIosIdForVendorAsync.mockResolvedValue("ios-vendor-id");
    mockApplication.getAndroidId.mockReturnValue("android-device-id");

    // Mock random bytes for predictable fallback IDs
    const mockRandomBytes = new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    mockCrypto.getRandomBytesAsync.mockResolvedValue(mockRandomBytes);
  });

  afterEach(() => {
    // Restore spies after each test
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("getDeviceId", () => {
    test("returns stored device ID if available", async () => {
      // Set up mock to return stored ID
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === "_better-auth.device_id") {
          return Promise.resolve("stored-device-id");
        }
        return Promise.resolve(null);
      });

      const deviceId = await getDeviceId();

      expect(deviceId).toBe("stored-device-id");
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "_better-auth.device_id",
      );
      // Verify we didn't try to generate a new ID
      expect(mockApplication.getIosIdForVendorAsync).not.toHaveBeenCalled();
      expect(mockCrypto.getRandomBytesAsync).not.toHaveBeenCalled();
    });

    test("generates iOS vendor ID when no stored ID exists on iOS", async () => {
      // No stored ID
      mockSecureStore.getItemAsync.mockImplementation((_key) => {
        return Promise.resolve(null);
      });

      // iOS vendor ID available
      mockApplication.getIosIdForVendorAsync.mockResolvedValue("ios-vendor-id");
      mockPlatform.OS = "ios";

      const deviceId = await getDeviceId();

      expect(deviceId).toBe("ios-vendor-id");
      expect(mockApplication.getIosIdForVendorAsync).toHaveBeenCalled();
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "_better-auth.device_id",
        "ios-vendor-id",
      );
    });

    test("generates Android ID when no stored ID exists on Android", async () => {
      // No stored ID
      mockSecureStore.getItemAsync.mockImplementation(() => {
        return Promise.resolve(null);
      });

      // Android ID available
      mockApplication.getAndroidId.mockReturnValue("android-device-id");
      mockPlatform.OS = "android";

      const deviceId = await getDeviceId();

      expect(deviceId).toBe("android-device-id");
      expect(mockApplication.getAndroidId).toHaveBeenCalled();
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "_better-auth.device_id",
        "android-device-id",
      );
    });

    test("falls back to stored Android unique ID if getAndroidId fails", async () => {
      // Set to Android platform
      mockPlatform.OS = "android";

      // No stored ID in main storage, but have a unique ID
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === "_better-auth.device_id") return Promise.resolve(null);
        if (key === "_better-auth.ANDROID_UNIQUE_ID")
          return Promise.resolve("stored-android-unique-id");
        return Promise.resolve(null);
      });

      // Android ID getter fails
      mockApplication.getAndroidId.mockImplementation(() => {
        throw new Error("getAndroidId failed");
      });

      const deviceId = await getDeviceId();

      expect(deviceId).toBe("stored-android-unique-id");
      expect(mockApplication.getAndroidId).toHaveBeenCalled();
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "_better-auth.ANDROID_UNIQUE_ID",
      );
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    test("generates fallback ID when iOS vendor ID fails", async () => {
      // No stored ID
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      // iOS vendor ID fails
      mockApplication.getIosIdForVendorAsync.mockRejectedValue(
        new Error("Vendor ID error"),
      );
      mockPlatform.OS = "ios";

      const deviceId = await getDeviceId();

      // Should match the format from the mock random bytes
      expect(deviceId).toBe("ios-0102030405060708090a0b0c0d0e0f10");
      expect(mockApplication.getIosIdForVendorAsync).toHaveBeenCalled();
      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    test("uses custom storage prefix when provided", async () => {
      const customKeys = {
        DEVICE_ID: "custom-prefix.device_id",
        STATE: "custom-prefix.passkey_state",
        USER_ID: "custom-prefix.user_id",
        CREDENTIAL_IDS: "custom-prefix.credential_ids",
      };

      (storageModule.getStorageKeys as jest.Mock).mockReturnValue(customKeys);

      // No stored ID
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      // iOS vendor ID available
      mockApplication.getIosIdForVendorAsync.mockResolvedValue("ios-vendor-id");

      const deviceId = await getDeviceId({ storagePrefix: "custom-prefix" });

      expect(deviceId).toBe("ios-vendor-id");
      expect(storageModule.getStorageKeys).toHaveBeenCalledWith({
        storagePrefix: "custom-prefix",
      });
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "custom-prefix.device_id",
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "custom-prefix.device_id",
        "ios-vendor-id",
      );
    });

    test("handles an unsupported platform gracefully", async () => {
      // No stored ID
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      // Set to unsupported platform
      mockPlatform.OS = "web";

      const deviceId = await getDeviceId();

      // Should generate a fallback ID with web prefix
      expect(deviceId).toMatch(/^web-/);
      expect(mockCrypto.getRandomBytesAsync).toHaveBeenCalled();
    });

    test("handles secure store failures on read", async () => {
      // Make secure store throw on read
      mockSecureStore.getItemAsync.mockRejectedValue(
        new Error("Storage read error"),
      );
      mockApplication.getIosIdForVendorAsync.mockResolvedValue("ios-vendor-id");

      const deviceId = await getDeviceId();

      // Should still get a valid ID
      expect(deviceId).toBe("ios-vendor-id");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    test("handles secure store failures on write", async () => {
      // No stored ID
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      // iOS vendor ID available
      mockApplication.getIosIdForVendorAsync.mockResolvedValue("ios-vendor-id");
      // Make secure store throw on write
      mockSecureStore.setItemAsync.mockRejectedValue(
        new Error("Storage write error"),
      );

      const deviceId = await getDeviceId();

      // Should still get a valid ID
      expect(deviceId).toBe("ios-vendor-id");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    test("creates Android fallback with device info when all else fails", async () => {
      // Set to Android platform
      mockPlatform.OS = "android";

      // No stored IDs
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      // Android ID getter fails
      mockApplication.getAndroidId.mockImplementation(() => {
        throw new Error("getAndroidId failed");
      });

      // ANDROID_UNIQUE_ID not found
      mockSecureStore.getItemAsync.mockImplementation((_key) => {
        return Promise.resolve(null);
      });

      // Generate fallback with device info
      const deviceId = await getDeviceId();

      // Should contain Android prefix
      expect(deviceId).toContain("android-");
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe("generateFallbackDeviceId", () => {
    test("generates a platform-specific random ID", async () => {
      // Test iOS platform
      mockPlatform.OS = "ios";
      const iosDeviceId = await generateFallbackDeviceId();
      expect(iosDeviceId).toMatch(/^ios-/);
      expect(iosDeviceId).toBe("ios-0102030405060708090a0b0c0d0e0f10");

      // Test Android platform
      mockPlatform.OS = "android";
      const androidDeviceId = await generateFallbackDeviceId();
      expect(androidDeviceId).toMatch(/^android-/);
      expect(androidDeviceId).toBe("android-0102030405060708090a0b0c0d0e0f10");
    });

    test("handles crypto errors gracefully", async () => {
      // Make crypto API fail
      mockCrypto.getRandomBytesAsync.mockRejectedValue(
        new Error("Crypto failed"),
      );

      // Should fall back to Math.random-based generation
      const deviceId = await generateFallbackDeviceId();

      expect(deviceId).toMatch(/^ios-/); // Should still have platform prefix
      expect(deviceId.length).toBeGreaterThan(10); // Should still have a reasonable length
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    test("throws PasskeyError for catastrophic failures", async () => {
      // Make both crypto and loadExpoModules fail
      mockCrypto.getRandomBytesAsync.mockRejectedValue(
        new Error("Crypto failed"),
      );

      // Mock loadExpoModules to fail when accessed in the fallback code path
      (modulesModule.loadExpoModules as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error("Module loading failed");
        },
      );

      await expect(generateFallbackDeviceId()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("getDeviceInfo", () => {
    test("returns complete device information", async () => {
      const deviceInfo = await getDeviceInfo();

      expect(deviceInfo).toMatchObject({
        deviceId: expect.any(String),
        platform: "ios",
        model: "iPhone 14",
        manufacturer: "Apple",
        osVersion: "16.0",
        appVersion: "1.0.0",
        biometricSupport: expect.objectContaining({
          isSupported: true,
          authenticationType: "Face ID",
        }),
      });
    });

    test("handles failed device ID generation", async () => {
      // Make getDeviceId throw in a way that forces the error path
      mockSecureStore.getItemAsync.mockImplementation(() =>
        Promise.reject(new Error("Storage read error")),
      );
      mockApplication.getIosIdForVendorAsync.mockImplementation(() =>
        Promise.reject(new Error("Vendor ID error")),
      );
      mockCrypto.getRandomBytesAsync.mockImplementation(() =>
        Promise.reject(new Error("Crypto failed")),
      );

      // Mock getSecureStore to throw
      (modulesModule.getSecureStore as jest.Mock).mockImplementationOnce(() => {
        throw new Error("SecureStore not available");
      });

      // Call the function - this should use the fallback path
      const deviceInfo = await getDeviceInfo();

      // Verify that we still get valid device info despite all errors
      expect(deviceInfo.deviceId).toBeDefined();
      expect(deviceInfo.platform).toBe("ios");
    });

    test("handles failed biometric support check", async () => {
      // Make biometric check throw
      (biometricsModule.checkBiometricSupport as jest.Mock).mockRejectedValue(
        new Error("Biometric check failed"),
      );

      // Should still return valid device info with fallback biometric support
      const deviceInfo = await getDeviceInfo();

      expect(deviceInfo.deviceId).toBeDefined();
      expect(deviceInfo.biometricSupport).toEqual(
        expect.objectContaining({
          isSupported: false,
          isEnrolled: false,
          error: expect.any(String),
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("passes options to getDeviceId and getStorageKeys", async () => {
      const options = { storagePrefix: "custom-prefix" };

      await getDeviceInfo(options);

      expect(storageModule.getStorageKeys).toHaveBeenCalledWith(options);
    });
  });

  describe("clearPasskeyData", () => {
    test("clears passkey data with default prefix", async () => {
      await clearPasskeyData();

      // Check that each key was deleted
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "_better-auth.device_id",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "_better-auth.user_id",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "_better-auth.passkey_state",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "_better-auth.credential_ids",
      );
    });

    test("clears passkey data with custom prefix", async () => {
      const customOptions = { storagePrefix: "custom-prefix" };
      const customKeys = {
        DEVICE_ID: "custom-prefix.device_id",
        STATE: "custom-prefix.passkey_state",
        USER_ID: "custom-prefix.user_id",
        CREDENTIAL_IDS: "custom-prefix.credential_ids",
      };

      (storageModule.getStorageKeys as jest.Mock).mockReturnValue(customKeys);

      await clearPasskeyData(customOptions);

      expect(storageModule.getStorageKeys).toHaveBeenCalledWith(customOptions);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "custom-prefix.device_id",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "custom-prefix.user_id",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "custom-prefix.passkey_state",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "custom-prefix.credential_ids",
      );
    });

    test("handles secure store errors gracefully", async () => {
      // Make secure store throw when called
      mockSecureStore.deleteItemAsync.mockImplementation(() =>
        Promise.reject(new Error("Delete failed")),
      );

      // The key test is that this should not throw an error
      await expect(clearPasskeyData()).resolves.not.toThrow();

      // Verify the function was actually called
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
    });
  });
});
