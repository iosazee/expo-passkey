import { ERROR_CODES } from "../../types";
import {
  authenticateWithBiometrics,
  checkBiometricSupport,
  getBiometricType,
  isPasskeySupported,
} from "../utils/biometrics";
import { isSupportedPlatform } from "../utils/environment";
import { loadExpoModules } from "../utils/modules";

// Mock the modules to control their behavior
jest.mock("../utils/modules");
jest.mock("../utils/environment", () => ({
  isSupportedPlatform: jest.fn(),
  validateExpoEnvironment: jest.fn(),
  isExpoEnvironment: jest.fn().mockReturnValue(true),
}));

describe("Biometrics Utilities", () => {
  // Define all mocks with proper types to avoid type errors
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

  // Allow OS to be changed in tests
  const mockPlatform: {
    OS: string;
    Version: string;
    select: jest.Mock;
  } = {
    OS: "ios",
    Version: "16.0",
    select: jest.fn((obj) => obj.ios),
  };

  const mockDevice: {
    modelName: string;
    manufacturer: string;
    brand: string;
    osVersion: string;
    platformApiLevel: number | undefined;
    osBuildId: string;
  } = {
    modelName: "iPhone 14",
    manufacturer: "Apple",
    brand: "Apple",
    osVersion: "16.0",
    platformApiLevel: undefined,
    osBuildId: "16A5288q",
  };

  // Set up mock loadExpoModules to return controlled values
  beforeEach(() => {
    // Configure module loader mock
    (loadExpoModules as jest.Mock).mockReturnValue({
      Platform: mockPlatform,
      LocalAuthentication: mockLocalAuthentication,
      Device: mockDevice,
      Application: {},
      SecureStore: {},
      Crypto: {},
    });

    // Reset all mocks before each test
    jest.clearAllMocks();

    // Reset platform and device properties to default (iOS) values
    mockPlatform.OS = "ios";
    mockPlatform.Version = "16.0";
    mockDevice.modelName = "iPhone 14";
    mockDevice.manufacturer = "Apple";
    mockDevice.brand = "Apple";
    mockDevice.osVersion = "16.0";
    mockDevice.platformApiLevel = undefined;
    mockDevice.osBuildId = "16A5288q";

    // Set default mock behavior
    mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue(
      [2],
    ); // Face ID by default
    mockLocalAuthentication.authenticateAsync.mockResolvedValue({
      success: true,
    });

    // Mock platform support to be true by default
    (isSupportedPlatform as jest.Mock).mockReturnValue(true);

    // Reset platform select function
    mockPlatform.select.mockImplementation((obj) => obj[mockPlatform.OS]);
  });

  describe("checkBiometricSupport", () => {
    test("returns correct info for supported iOS device with Face ID", async () => {
      // All defaults are set for iOS with Face ID in beforeEach
      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: true,
        isEnrolled: true,
        authenticationType: "Face ID",
        error: null,
        platformDetails: {
          platform: "ios",
          version: "16.0",
        },
      });
    });

    test("returns correct info for supported iOS device with Touch ID", async () => {
      // Change to Touch ID
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue(
        [1],
      ); // Touch ID

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: true,
        isEnrolled: true,
        authenticationType: "Touch ID",
        error: null,
        platformDetails: {
          platform: "ios",
          version: "16.0",
        },
      });
    });

    test("returns unsupported info for iOS < 16", async () => {
      // Override Platform.Version for iOS 15
      mockPlatform.Version = "15.0";
      mockDevice.osVersion = "15.0";

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: false,
        isEnrolled: false,
        authenticationType: "None",
        error: "iOS 16 or higher required for passkey support",
        platformDetails: {
          platform: "ios",
          version: "15.0",
        },
      });
    });

    test("returns correct info for supported Android device with Fingerprint", async () => {
      // Change platform to Android
      mockPlatform.OS = "android";
      mockPlatform.Version = "11";
      mockDevice.modelName = "Pixel 6";
      mockDevice.manufacturer = "Google";
      mockDevice.brand = "Google";
      mockDevice.osVersion = "11";
      mockDevice.platformApiLevel = 30; // Android 11
      mockDevice.osBuildId = "RP1A.200720.009";

      // Set up Android-specific authentication
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue(
        [1],
      ); // Fingerprint

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: true,
        isEnrolled: true,
        authenticationType: "Fingerprint",
        error: null,
        platformDetails: {
          platform: "android",
          version: "11",
          apiLevel: 30,
          manufacturer: "Google",
          brand: "Google",
        },
      });
    });

    test("returns correct info for Android device with Face Unlock", async () => {
      // Set up Android device
      mockPlatform.OS = "android";
      mockPlatform.Version = "11";
      mockDevice.platformApiLevel = 30; // Android 11
      mockDevice.manufacturer = "Google";
      mockDevice.brand = "Google";

      // Set up facial recognition
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue(
        [2],
      ); // Facial recognition

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: true,
        isEnrolled: true,
        authenticationType: "Face Unlock",
        error: null,
        platformDetails: {
          platform: "android",
          apiLevel: 30,
        },
      });
    });

    test("returns correct info for Android device with Iris scanning", async () => {
      // Set up Android device
      mockPlatform.OS = "android";
      mockPlatform.Version = "11";
      mockDevice.platformApiLevel = 30; // Android 11
      mockDevice.manufacturer = "Samsung";
      mockDevice.brand = "Samsung";

      // Set up iris recognition
      mockLocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue(
        [3],
      ); // Iris

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: true,
        isEnrolled: true,
        authenticationType: "Iris",
        error: null,
        platformDetails: {
          platform: "android",
          apiLevel: 30,
        },
      });
    });

    test("returns unsupported info for Android < 6.0", async () => {
      // Change platform to Android with old API level
      mockPlatform.OS = "android";
      mockPlatform.Version = "5.1";
      mockDevice.platformApiLevel = 22; // Android 5.1
      mockDevice.manufacturer = "Samsung";
      mockDevice.brand = "Samsung";

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: false,
        isEnrolled: false,
        authenticationType: "None",
        // Update error message to match new implementation requirement
        error: "Android 10 (API 29) or higher required for passkey support",
        platformDetails: {
          platform: "android",
          apiLevel: 22,
        },
      });
    });

    test("returns unsupported info for other platforms", async () => {
      // Set to an unsupported platform
      mockPlatform.OS = "web";
      mockPlatform.Version = "1.0";

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: false,
        isEnrolled: false,
        authenticationType: "None",
        error: "Unsupported platform",
        platformDetails: {
          platform: "web",
          version: "1.0",
        },
      });
    });

    test("returns unsupported when hardware check fails", async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(false);

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: false,
        isEnrolled: true,
        authenticationType: "Face ID",
        error: null,
      });
    });

    test("returns unenrolled when enrollment check fails", async () => {
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: true,
        isEnrolled: false,
        authenticationType: "Face ID",
        error: null,
      });
    });

    test("handles errors gracefully", async () => {
      // Simulate an error in authentication check
      mockLocalAuthentication.hasHardwareAsync.mockRejectedValue(
        new Error("Test error"),
      );

      const result = await checkBiometricSupport();

      expect(result).toMatchObject({
        isSupported: false,
        isEnrolled: false,
        authenticationType: "None",
        error: "Test error",
        platformDetails: {
          platform: "ios",
          version: "16.0",
        },
      });
    });
  });

  describe("getBiometricType", () => {
    test("returns Face ID for iOS with facial recognition", () => {
      mockPlatform.OS = "ios";
      const result = getBiometricType([2]); // Facial recognition
      expect(result).toBe("Face ID");
    });

    test("returns Touch ID for iOS with fingerprint", () => {
      mockPlatform.OS = "ios";
      const result = getBiometricType([1]); // Fingerprint
      expect(result).toBe("Touch ID");
    });

    test("returns None for iOS with no biometric types", () => {
      mockPlatform.OS = "ios";
      const result = getBiometricType([]);
      expect(result).toBe("None");
    });

    test("returns Fingerprint for Android with fingerprint", () => {
      mockPlatform.OS = "android";
      const result = getBiometricType([1]); // Fingerprint
      expect(result).toBe("Fingerprint");
    });

    test("returns Face Unlock for Android with facial recognition", () => {
      mockPlatform.OS = "android";
      const result = getBiometricType([2]); // Facial recognition
      expect(result).toBe("Face Unlock");
    });

    test("returns Iris for Android with iris scanner", () => {
      mockPlatform.OS = "android";
      const result = getBiometricType([3]); // Iris
      expect(result).toBe("Iris");
    });

    test("returns Biometric for unknown platform", () => {
      mockPlatform.OS = "web";
      const result = getBiometricType([1]);
      expect(result).toBe("Biometric");
    });
  });

  describe("authenticateWithBiometrics", () => {
    test("returns true when authentication succeeds on iOS", async () => {
      // Use iOS defaults set in beforeEach
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      const options = {
        promptMessage: "Sign in with Face ID",
        cancelLabel: "Cancel",
        disableDeviceFallback: true,
        fallbackLabel: "",
      };

      const result = await authenticateWithBiometrics(options);

      expect(result).toBe(true);
      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        options,
      );
    });

    test("returns true when authentication succeeds on Android", async () => {
      // Set up Android device
      mockPlatform.OS = "android";
      mockDevice.platformApiLevel = 30;
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: true,
      });

      const options = {
        promptMessage: "Sign in with fingerprint",
        cancelLabel: "Cancel",
        disableDeviceFallback: true,
        fallbackLabel: "",
      };

      const result = await authenticateWithBiometrics(options);

      expect(result).toBe(true);
      expect(mockLocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        options,
      );
    });

    test("throws error when authentication fails", async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: "Authentication failed",
      });

      const options = {
        promptMessage: "Test prompt",
        cancelLabel: "Cancel",
        disableDeviceFallback: true,
        fallbackLabel: "",
      };

      try {
        await authenticateWithBiometrics(options);
        fail("Expected authenticateWithBiometrics to throw an error");
      } catch (error) {
        // Check that error is a PasskeyError with the correct code
        expect(error).toBeDefined();
        expect((error as { code: string }).code).toBe(
          ERROR_CODES.BIOMETRIC.AUTHENTICATION_FAILED,
        );
      }
    });

    test("includes error message from LocalAuthentication when available", async () => {
      mockLocalAuthentication.authenticateAsync.mockResolvedValue({
        success: false,
        error: "User cancelled",
      });

      const options = {
        promptMessage: "Test prompt",
        cancelLabel: "Cancel",
        disableDeviceFallback: true,
        fallbackLabel: "",
      };

      try {
        await authenticateWithBiometrics(options);
        fail("Should have thrown an error");
      } catch (error) {
        expect((error as { message: string }).message).toBe("User cancelled");
      }
    });
  });

  describe("isPasskeySupported", () => {
    test("returns true for supported iOS configurations", async () => {
      // iOS defaults set in beforeEach
      (isSupportedPlatform as jest.Mock).mockReturnValue(true);

      const result = await isPasskeySupported();
      expect(result).toBe(true);
    });

    test("returns true for supported Android configurations", async () => {
      // Set up Android device
      mockPlatform.OS = "android";
      mockDevice.platformApiLevel = 30;

      (isSupportedPlatform as jest.Mock).mockReturnValue(true);

      const result = await isPasskeySupported();
      expect(result).toBe(true);
    });

    test("returns false when biometrics are not supported", async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(false);

      const result = await isPasskeySupported();
      expect(result).toBe(false);
    });

    test("returns false when biometrics are not enrolled", async () => {
      mockLocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuthentication.isEnrolledAsync.mockResolvedValue(false);

      const result = await isPasskeySupported();
      expect(result).toBe(false);
    });

    test("returns false for unsupported iOS version", async () => {
      mockPlatform.OS = "ios";
      mockPlatform.Version = "15.0";

      (isSupportedPlatform as jest.Mock).mockReturnValue(false);

      const result = await isPasskeySupported();
      expect(result).toBe(false);
    });

    test("returns false for unsupported Android API level", async () => {
      mockPlatform.OS = "android";
      mockDevice.platformApiLevel = 28; // Android 9

      (isSupportedPlatform as jest.Mock).mockReturnValue(false);

      const result = await isPasskeySupported();
      expect(result).toBe(false);
    });

    test("returns false for unsupported platforms", async () => {
      mockPlatform.OS = "web";

      const result = await isPasskeySupported();
      expect(result).toBe(false);
    });

    test("handles errors gracefully", async () => {
      // Mock an error during the check
      mockLocalAuthentication.hasHardwareAsync.mockRejectedValue(
        new Error("Test error"),
      );

      const result = await isPasskeySupported();
      expect(result).toBe(false);
    });
  });
});
