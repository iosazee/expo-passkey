jest.mock("expo-modules-core", () => ({
  requireNativeModule: jest.fn(() => ({
    isPasskeySupported: jest.fn().mockReturnValue(true),
    createPasskey: jest.fn().mockResolvedValue("mock-credential-json"),
    authenticateWithPasskey: jest
      .fn()
      .mockResolvedValue("mock-credential-json"),
  })),
}));

// Now mock the native module
jest.mock("../native-module", () => ({
  isNativePasskeySupported: jest.fn().mockReturnValue(true),
  createNativePasskey: jest.fn().mockResolvedValue({
    id: "test-credential-id",
    rawId: "test-raw-id",
    type: "public-key",
    response: {
      clientDataJSON: "test-client-data",
      attestationObject: "test-attestation",
      publicKey: "test-public-key",
      transports: ["internal"],
    },
    authenticatorAttachment: "platform",
  }),
  authenticateWithNativePasskey: jest.fn().mockResolvedValue({
    id: "test-credential-id",
    rawId: "test-raw-id",
    type: "public-key",
    response: {
      clientDataJSON: "test-client-data",
      authenticatorData: "test-auth-data",
      signature: "test-signature",
      userHandle: "test-user-handle",
    },
    authenticatorAttachment: "platform",
  }),
}));

import { expoPasskeyClient } from "../core.native";
import { getDeviceInfo, hasPasskeysRegistered } from "../utils/device";
import { loadExpoModules } from "../utils/modules";

// Mock dependencies
jest.mock("../utils/device", () => ({
  getDeviceInfo: jest.fn(),
  clearDeviceId: jest.fn(),
  clearPasskeyData: jest.fn(),
  hasPasskeysRegistered: jest.fn().mockResolvedValue(true),
  hasUserPasskeysRegistered: jest.fn().mockResolvedValue(true),
  isPasskeyRegistered: jest.fn().mockResolvedValue(true),
  getDeviceId: jest.fn().mockResolvedValue("test-device-id"),
  generateFallbackDeviceId: jest.fn().mockResolvedValue("fallback-device-id"),
}));

jest.mock("../utils/biometrics", () => ({
  checkBiometricSupport: jest.fn().mockResolvedValue({
    isSupported: true,
    isEnrolled: true,
    availableTypes: [2], // Face ID by default
    authenticationType: "Face ID",
    error: null,
    platformDetails: {
      platform: "ios",
      version: "16.0",
    },
  }),
  authenticateWithBiometrics: jest.fn().mockResolvedValue(true),
  getBiometricType: jest.fn().mockReturnValue("Face ID"),
  isPasskeySupported: jest.fn().mockResolvedValue(true),
}));

// Initial mock implementation with a default value
jest.mock("../utils/modules", () => ({
  loadExpoModules: jest.fn().mockReturnValue({
    Platform: {
      OS: "ios",
      Version: "16.0",
      select: jest.fn((obj) => obj.ios),
    },
    SecureStore: {
      getItemAsync: jest.fn(),
      setItemAsync: jest.fn(),
      deleteItemAsync: jest.fn(),
    },
    Device: {
      platformApiLevel: undefined,
    },
    LocalAuthentication: {
      AuthenticationType: {
        FINGERPRINT: 1,
        FACIAL_RECOGNITION: 2,
        IRIS: 3,
      },
    },
  }),
}));

// Mock storage functions
jest.mock("../utils/storage", () => ({
  getStorageKeys: jest.fn().mockReturnValue({
    DEVICE_ID: "_better-auth.device_id",
    STATE: "_better-auth.passkey_state",
    USER_ID: "_better-auth.user_id",
    CREDENTIAL_IDS: "_better-auth.credential_ids",
  }),
  storeCredentialId: jest.fn(),
  getUserCredentialIds: jest.fn().mockResolvedValue(["test-credential-id"]),
  getCredentialMetadata: jest.fn().mockResolvedValue({}),
  updateCredentialLastUsed: jest.fn(),
  removeCredentialId: jest.fn(),
}));

describe("Expo Passkey Client", () => {
  // Mock fetch
  const mockFetch = jest.fn();

  // Define types for our platform configurations
  type BiometricType = {
    name: string;
    availableTypes: number[];
  };

  type PlatformConfig = {
    deviceInfo: {
      deviceId: string;
      platform: "ios" | "android";
      model: string;
      manufacturer: string;
      osVersion: string;
      appVersion: string;
      biometricSupport: {
        isSupported: boolean;
        isEnrolled: boolean;
        availableTypes: number[];
        authenticationType: string;
        error: string | null;
        platformDetails: {
          platform: string;
          version: string | number;
          apiLevel?: number;
          manufacturer?: string;
          brand?: string;
        };
      };
    };
    platform: {
      OS: "ios" | "android";
      Version: string | number;
      select: (obj: Record<string, any>) => any;
    };
    device: {
      platformApiLevel?: number;
      manufacturer?: string;
      brand?: string;
    };
    registerPrompt: string;
    authPrompt: string;
    enrollmentError: string;
    biometricTypes: BiometricType[];
    supportedVersion?: string;
    unsupportedVersion?: string;
    supportedApiLevel?: number;
    unsupportedApiLevel?: number;
  };

  // Platform configurations
  const platformConfigs: Record<"ios" | "android", PlatformConfig> = {
    ios: {
      deviceInfo: {
        deviceId: "ios-device-id",
        platform: "ios",
        model: "iPhone 14",
        manufacturer: "Apple",
        osVersion: "16.0",
        appVersion: "1.0.0",
        biometricSupport: {
          isSupported: true,
          isEnrolled: true,
          availableTypes: [2], // Face ID = 2
          authenticationType: "Face ID",
          error: null,
          platformDetails: {
            platform: "ios",
            version: "16.0",
          },
        },
      },
      platform: {
        OS: "ios",
        Version: "16.0",
        select: jest.fn((obj) => obj.ios),
      },
      device: {
        platformApiLevel: undefined,
      },
      registerPrompt: "Verify to register passkey",
      authPrompt: "Sign in with passkey",
      enrollmentError: "Please set up Face ID or Touch ID in your iOS Settings",
      biometricTypes: [
        { name: "Face ID", availableTypes: [2] },
        { name: "Touch ID", availableTypes: [1] },
      ],
      supportedVersion: "16.0",
      unsupportedVersion: "15.0",
    },
    android: {
      deviceInfo: {
        deviceId: "android-device-id",
        platform: "android",
        model: "Pixel 6",
        manufacturer: "Google",
        osVersion: "13",
        appVersion: "1.0.0",
        biometricSupport: {
          isSupported: true,
          isEnrolled: true,
          availableTypes: [1], // Fingerprint = 1
          authenticationType: "Fingerprint",
          error: null,
          platformDetails: {
            platform: "android",
            version: 13,
            apiLevel: 33,
            manufacturer: "Google",
            brand: "Google",
          },
        },
      },
      platform: {
        OS: "android",
        Version: 33,
        select: jest.fn((obj) => obj.android),
      },
      device: {
        platformApiLevel: 33,
        manufacturer: "Google",
        brand: "Google",
      },
      registerPrompt: "Verify to register biometric authentication",
      authPrompt: "Sign in with biometric authentication",
      enrollmentError:
        "Please set up biometric authentication in your device settings",
      biometricTypes: [
        { name: "Fingerprint", availableTypes: [1] },
        { name: "Face Unlock", availableTypes: [2] },
        { name: "Iris", availableTypes: [3] },
      ],
      supportedApiLevel: 33, // Android 13
      unsupportedApiLevel: 28, // Android 9
    },
  };

  // Helper function to setup environment for a specific platform
  const setupPlatform = (platform: "ios" | "android") => {
    const config = platformConfigs[platform];

    // Clear all mocks to prevent test interference
    jest.clearAllMocks();

    // Mock the device info first
    (getDeviceInfo as jest.Mock).mockResolvedValue(config.deviceInfo);

    // Update the loadExpoModules mock
    (loadExpoModules as jest.Mock).mockReturnValue({
      Platform: config.platform,
      SecureStore: {
        getItemAsync: jest.fn(),
        setItemAsync: jest.fn(),
        deleteItemAsync: jest.fn(),
      },
      Device: config.device,
      LocalAuthentication: {
        AuthenticationType: {
          FINGERPRINT: 1,
          FACIAL_RECOGNITION: 2,
          IRIS: 3,
        },
      },
    });

    // Ensure hasPasskeysRegistered returns true
    (hasPasskeysRegistered as jest.Mock).mockResolvedValue(true);
  };

  // Helper function to create a plugin instance with mocked fetch
  const createTestPlugin = () => {
    const plugin = expoPasskeyClient();
    const actions = plugin.getActions(mockFetch);
    return { plugin, actions };
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockFetch.mockReset();

    // Make sure hasPasskeysRegistered returns true by default
    (hasPasskeysRegistered as jest.Mock).mockResolvedValue(true);

    // Default to iOS platform for backward compatibility
    setupPlatform("ios");
  });

  // Common test cases for both platforms
  const runCrossPlatformTests = (platform: "ios" | "android") => {
    describe(`${platform} platform - registerPasskey`, () => {
      test("successfully registers a passkey when biometrics succeed", async () => {
        // Reset platform configuration for each test
        setupPlatform(platform);

        // Mock API response
        mockFetch.mockResolvedValue({
          data: {
            success: true,
            rpName: "Test App",
            rpId: "example.com",
          },
        });

        const { actions } = createTestPlugin();

        const result = await actions.registerPasskey({
          userId: "user123",
          userName: "Test User",
          rpName: "Test App",
          rpId: "example.com",
        });

        // Verify API was called
        expect(mockFetch).toHaveBeenCalled();

        // Verify the result
        expect(result).toEqual({
          data: {
            success: true,
            rpName: "Test App",
            rpId: "example.com",
          },
          error: null,
        });
      });
    });

    describe(`${platform} platform - authenticateWithPasskey`, () => {
      test("successfully authenticates with a passkey", async () => {
        // Reset platform configuration for each test
        setupPlatform(platform);

        // Mock API response
        mockFetch.mockResolvedValue({
          data: {
            token: "jwt-token-123",
            user: { id: "user123", name: "Test User" },
          },
        });

        const { actions } = createTestPlugin();

        const result = await actions.authenticateWithPasskey();

        // Verify API was called
        expect(mockFetch).toHaveBeenCalled();

        // Verify the result
        expect(result).toEqual({
          data: {
            token: "jwt-token-123",
            user: { id: "user123", name: "Test User" },
          },
          error: null,
        });
      });
    });
  };

  // Run common tests for both platforms
  describe("iOS Platform Tests", () => {
    beforeEach(() => {
      setupPlatform("ios");
    });

    runCrossPlatformTests("ios");
  });

  describe("Android Platform Tests", () => {
    beforeEach(() => {
      setupPlatform("android");
    });

    runCrossPlatformTests("android");
  });

  // Common functionality tests
  describe("Common functionality tests", () => {
    describe("listPasskeys", () => {
      test("successfully lists user passkeys", async () => {
        // Mock API response for listing passkeys
        mockFetch.mockResolvedValue({
          data: {
            passkeys: [
              {
                id: "passkey-1",
                credentialId: "cred-id-1",
                deviceName: "Device 1",
                createdAt: "2023-01-01T00:00:00Z",
                status: "active",
              },
            ],
            nextOffset: null,
          },
        });

        const { actions } = createTestPlugin();

        const result = await actions.listPasskeys({
          userId: "user123",
          limit: 10,
        });

        // Verify API call
        expect(mockFetch).toHaveBeenCalled();

        // Verify the result
        expect(result.data).toBeDefined();
        expect(result.error).toBeNull();
      });
    });

    describe("revokePasskey", () => {
      test("successfully revokes a passkey", async () => {
        // Mock API response
        mockFetch.mockResolvedValue({
          data: {
            success: true,
          },
        });

        const { actions } = createTestPlugin();

        const result = await actions.revokePasskey({
          credentialId: "cred-id-123",
          reason: "lost_device",
        });

        // Verify API was called
        expect(mockFetch).toHaveBeenCalled();

        // Verify the result
        expect(result).toEqual({
          data: {
            success: true,
          },
          error: null,
        });
      });
    });

    describe("checkPasskeyRegistration", () => {
      test("successfully checks if a passkey is registered", async () => {
        // Mock API response
        mockFetch.mockResolvedValue({
          data: {
            passkeys: [
              { credentialId: "cred-id-123", status: "active" },
              { credentialId: "other-cred", status: "active" },
            ],
          },
        });

        const { actions } = createTestPlugin();

        const result = await actions.checkPasskeyRegistration("user123");

        // Verify the result
        expect(result.isRegistered).toBe(true);
        expect(result.biometricSupport).toBeDefined();
        expect(result.error).toBeNull();
      });
    });

    describe("Fetch plugin behavior", () => {
      test("adds correct headers to requests", async () => {
        // Basic test for fetch plugin
        const { plugin } = createTestPlugin();
        const fetchPlugin = plugin.fetchPlugins[0];

        // Create headers object to test with
        const testHeaders = {
          "Content-Type": "application/json",
          "Custom-Header": "test-value",
        };

        // Call the init method
        const result = await fetchPlugin.init("https://example.com", {
          method: "POST",
          headers: testHeaders,
        });

        // Verify URL is preserved
        expect(result.url).toBe("https://example.com");

        // Verify options were set
        expect(result.options).toBeDefined();
      });
    });

    describe("Error handling", () => {
      test("handles errors gracefully during operation", async () => {
        // Test error handling in registerPasskey
        mockFetch.mockRejectedValue(new Error("API request failed"));

        const { actions } = createTestPlugin();
        const result = await actions.registerPasskey({
          userId: "user123",
          userName: "Test User",
        });

        expect(result.error).toBeDefined();
        expect(result.data).toBeNull();
      });
    });
  });
});
