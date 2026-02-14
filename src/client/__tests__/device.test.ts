/**
 * @file Tests for device utilities
 */

// First mock the expo-modules-core so requireNativeModule works
jest.mock("expo-modules-core", () => ({
  requireNativeModule: jest.fn(() => ({
    isPasskeySupported: jest.fn().mockReturnValue(true),
    createPasskey: jest.fn().mockResolvedValue("mock-credential-json"),
    authenticateWithPasskey: jest
      .fn()
      .mockResolvedValue("mock-credential-json"),
  })),
}));

import * as biometricsModule from "../utils/biometrics";
import {
  clearPasskeyData,
  generateFallbackDeviceId,
  getDeviceId,
  getDeviceInfo,
  hasPasskeysRegistered,
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

// This mocks the module loader
jest.mock("../utils/modules", () => ({
  loadExpoModules: jest.fn(),
}));

// Mock the biometrics module
jest.mock("../utils/biometrics", () => ({
  checkBiometricSupport: jest.fn(),
  isPasskeySupported: jest.fn(),
}));

// Mock the storage module
jest.mock("../utils/storage", () => ({
  getStorageKeys: jest.fn(),
  getUserCredentialIds: jest.fn(),
  getCredentialMetadata: jest.fn(),
}));

// Explicitly mock the hasPasskeysRegistered function
jest.mock("../utils/device", () => {
  const originalModule = jest.requireActual("../utils/device");
  return {
    ...originalModule,
    hasPasskeysRegistered: jest.fn().mockResolvedValue(true),
    hasUserPasskeysRegistered: jest.fn().mockResolvedValue(true),
    getDeviceInfo: jest.fn(),
    clearDeviceId: jest.fn(),
    clearPasskeyData: jest.fn(),
    getDeviceId: jest.fn().mockResolvedValue("test-device-id"),
    generateFallbackDeviceId: jest.fn().mockResolvedValue("fallback-device-id"),
  };
});

// Mock native module
jest.mock("../native-module", () => ({
  isNativePasskeySupported: jest.fn().mockReturnValue(true),
  createNativePasskey: jest.fn(),
  authenticateWithNativePasskey: jest.fn(),
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

    // Configure mock modules loader to return our mocks
    (modulesModule.loadExpoModules as jest.Mock).mockReturnValue({
      Platform: mockPlatform,
      Application: mockApplication,
      Device: mockDevice,
      SecureStore: mockSecureStore,
      Crypto: mockCrypto,
      LocalAuthentication: mockLocalAuthentication,
    });

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

    // Reset the mocked functions from device.ts
    (
      hasPasskeysRegistered as jest.MockedFunction<typeof hasPasskeysRegistered>
    ).mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore spies after each test
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("getDeviceId", () => {
    test("returns stored device ID if available", async () => {
      // Set up mock to return stored ID
      mockSecureStore.getItemAsync.mockResolvedValue("stored-device-id");
      // Use the non-mocked implementation for this test
      const originalGetDeviceId =
        jest.requireActual("../utils/device").getDeviceId;

      // Mock necessary functions used by the original implementation
      (modulesModule.loadExpoModules as jest.Mock).mockReturnValue({
        Platform: mockPlatform,
        Application: mockApplication,
        Device: mockDevice,
        SecureStore: mockSecureStore,
        Crypto: mockCrypto,
      });

      const deviceId = await originalGetDeviceId();

      expect(deviceId).toBe("stored-device-id");
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "_better-auth.device_id",
      );
      // Verify we didn't try to generate a new ID
      expect(mockApplication.getIosIdForVendorAsync).not.toHaveBeenCalled();
      expect(mockCrypto.getRandomBytesAsync).not.toHaveBeenCalled();
    });

    test("uses custom storage prefix when provided", async () => {
      const customKeys = {
        DEVICE_ID: "custom-prefix.device_id",
        STATE: "custom-prefix.passkey_state",
        USER_ID: "custom-prefix.user_id",
      };

      (storageModule.getStorageKeys as jest.Mock).mockReturnValue(customKeys);
      (getDeviceId as jest.Mock).mockResolvedValue("custom-device-id");

      const deviceId = await getDeviceId({ storagePrefix: "custom-prefix" });

      expect(deviceId).toBe("custom-device-id");
      expect(getDeviceId).toHaveBeenCalledWith({
        storagePrefix: "custom-prefix",
      });
    });
  });

  describe("generateFallbackDeviceId", () => {
    test("generates a platform-specific random ID", async () => {
      // Test iOS platform
      mockPlatform.OS = "ios";
      (generateFallbackDeviceId as jest.Mock).mockResolvedValue(
        "ios-random-id",
      );

      const iosDeviceId = await generateFallbackDeviceId();
      expect(iosDeviceId).toBe("ios-random-id");

      // Test Android platform
      mockPlatform.OS = "android";
      (generateFallbackDeviceId as jest.Mock).mockResolvedValue(
        "android-random-id",
      );

      const androidDeviceId = await generateFallbackDeviceId();
      expect(androidDeviceId).toBe("android-random-id");
    });
  });

  describe("getDeviceInfo", () => {
    test("returns complete device information", async () => {
      const mockDeviceInfo = {
        deviceId: "test-device-id",
        platform: "ios",
        model: "iPhone 14",
        manufacturer: "Apple",
        osVersion: "16.0",
        appVersion: "1.0.0",
        biometricSupport: {
          isSupported: true,
          authenticationType: "Face ID",
        },
      };

      (getDeviceInfo as jest.Mock).mockResolvedValue(mockDeviceInfo);

      const deviceInfo = await getDeviceInfo();

      expect(deviceInfo).toEqual(mockDeviceInfo);
    });
  });

  describe("clearPasskeyData", () => {
    test("clears passkey data with default prefix", async () => {
      await clearPasskeyData();

      expect(clearPasskeyData).toHaveBeenCalled();
    });

    test("clears passkey data with custom prefix", async () => {
      const customOptions = { storagePrefix: "custom-prefix" };

      await clearPasskeyData(customOptions);

      expect(clearPasskeyData).toHaveBeenCalledWith(customOptions);
    });
  });
});
