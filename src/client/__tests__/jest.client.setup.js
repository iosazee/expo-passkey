// Add Buffer polyfill for Node.js environment using CommonJS syntax
const { Buffer } = require("buffer");

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

// Setup basic DOM globals if needed for base64 operations
if (typeof global.btoa === "undefined") {
  global.btoa = (str) => Buffer.from(str, "binary").toString("base64");
}

if (typeof global.atob === "undefined") {
  global.atob = (str) => Buffer.from(str, "base64").toString("binary");
}

jest.mock("expo-modules-core", () => ({
  requireOptionalNativeModule: jest.fn().mockImplementation(() => ({
    isPasskeySupported: jest.fn().mockResolvedValue(true),
    createPasskey: jest.fn().mockResolvedValue(
      JSON.stringify({
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
    ),
    authenticateWithPasskey: jest.fn().mockResolvedValue(
      JSON.stringify({
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
    ),
  })),
  requireNativeModule: jest.fn().mockImplementation(() => ({
    isPasskeySupported: jest.fn().mockReturnValue(true),
    createPasskey: jest.fn().mockResolvedValue(
      JSON.stringify({
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
    ),
    authenticateWithPasskey: jest.fn().mockResolvedValue(
      JSON.stringify({
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
    ),
  })),
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: "16.0",
    select: jest.fn((obj) => obj.ios),
  },
}));

jest.mock("expo", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("expo-application", () => ({
  __esModule: true,
  getIosIdForVendorAsync: jest.fn(() => Promise.resolve("ios-vendor-id-123")),
  getAndroidId: jest.fn(() => "android-id-123"),
  nativeApplicationVersion: "1.0.0",
}));

jest.mock("expo-device", () => ({
  __esModule: true,
  modelName: "iPhone 14",
  manufacturer: "Apple",
  brand: "Apple",
  osVersion: "16.0",
  platformApiLevel: undefined,
  osBuildId: "16A5288q",
}));

jest.mock("expo-local-authentication", () => ({
  __esModule: true,
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

jest.mock("expo-secure-store", () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  __esModule: true,
  getRandomBytesAsync: jest.fn(),
}));

// Mock native module to prevent actual module resolution
jest.mock("../native-module", () => ({
  getNativeModule: jest.fn().mockReturnValue({
    isPasskeySupported: jest.fn().mockReturnValue(true),
    createPasskey: jest.fn().mockResolvedValue(
      JSON.stringify({
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
    ),
    authenticateWithPasskey: jest.fn().mockResolvedValue(
      JSON.stringify({
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
    ),
  }),
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

// Mock @simplewebauthn/browser for when other modules import it
// but use virtual: true so specific tests can override
jest.mock(
  "@simplewebauthn/browser",
  () => ({
    browserSupportsWebAuthn: jest.fn().mockReturnValue(false),
    startRegistration: jest.fn(),
    startAuthentication: jest.fn(),
  }),
  { virtual: true },
);

// Setup minimal window and navigator for general compatibility
// Individual tests can override these as needed
if (typeof global.window === "undefined") {
  global.window = {
    location: {
      hostname: "localhost",
      protocol: "https:",
    },
    PublicKeyCredential: undefined,
  };
}

if (typeof global.navigator === "undefined") {
  global.navigator = {
    userAgent: "Mozilla/5.0 (test)",
    platform: "test",
    credentials: undefined,
  };
}

// Set up default mock implementations for common needs
// Using an IIFE instead of beforeEach since this is a setup file
(() => {
  const {
    hasHardwareAsync,
    isEnrolledAsync,
    supportedAuthenticationTypesAsync,
    authenticateAsync,
  } = require("expo-local-authentication");
  const { getRandomBytesAsync } = require("expo-crypto");

  // Default to successful biometric authentication
  hasHardwareAsync.mockResolvedValue(true);
  isEnrolledAsync.mockResolvedValue(true);
  supportedAuthenticationTypesAsync.mockResolvedValue([2]); // Face ID by default
  authenticateAsync.mockResolvedValue({ success: true });

  // Default random bytes for ID generation
  const randomBytes = new Uint8Array([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  getRandomBytesAsync.mockResolvedValue(randomBytes);
})();

// Silence console errors in tests that intentionally test error paths - using IIFE
(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  // Add a cleanup handler to Node's process to restore mocks on exit
  process.on("beforeExit", () => {
    jest.restoreAllMocks();
  });
})();
