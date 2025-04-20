// Mock the native module before importing
jest.mock("../native-module", () => ({
  getNativeModule: jest.fn(),
  isNativePasskeySupported: jest.fn().mockResolvedValue(true),
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

import { expoPasskeyClient } from "../core";
import { authenticateWithBiometrics } from "../utils/biometrics";
import { getDeviceInfo, isPasskeyRegistered } from "../utils/device";
import { loadExpoModules } from "../utils/modules";

// Mock dependencies
jest.mock("../utils/device", () => ({
  getDeviceInfo: jest.fn(),
  clearDeviceId: jest.fn(),
  clearPasskeyData: jest.fn(), // Add clearPasskeyData mock
  isPasskeyRegistered: jest.fn().mockResolvedValue(true), // Default to true for auth tests
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

    // Ensure isPasskeyRegistered returns true for authentication tests
    (isPasskeyRegistered as jest.Mock).mockResolvedValue(true);

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

    // Make sure isPasskeyRegistered returns true by default
    (isPasskeyRegistered as jest.Mock).mockResolvedValue(true);

    // Default to iOS platform for backward compatibility
    setupPlatform("ios");
  });

  // Common test cases for both platforms
  const runCrossPlatformTests = (platform: "ios" | "android") => {
    const _config = platformConfigs[platform];

    describe(`${platform} platform - registerPasskey`, () => {
      test("successfully registers a passkey when biometrics succeed", async () => {
        // Reset platform configuration for each test
        setupPlatform(platform);

        // Mock response for biometrics
        (authenticateWithBiometrics as jest.Mock).mockResolvedValue(true);

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
          userName: "Test User", // Add the required userName field
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

        // Mock biometrics authentication
        (authenticateWithBiometrics as jest.Mock).mockResolvedValue(true);

        // Ensure isPasskeyRegistered returns true for authentication
        (isPasskeyRegistered as jest.Mock).mockResolvedValue(true);

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
          userId: "user123",
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
        // Make sure isPasskeyRegistered returns true
        (isPasskeyRegistered as jest.Mock).mockResolvedValue(true);

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
        expect(result.credentialIds).toContain("cred-id-123");
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
