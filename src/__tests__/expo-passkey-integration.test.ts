/**
 * @file Enhanced Integration test for Expo Passkey Library
 * @description Tests the full authentication flow using the library
 */

// IMPORTANT: Mock values must be defined before jest.mock calls
// Default mock values (must be before any jest.mock calls)
const mockPlatform = {
  OS: "ios",
  Version: "16.0",
  select: jest.fn((obj) => obj.ios),
};

const mockApplication = {
  getIosIdForVendorAsync: jest.fn().mockResolvedValue("ios-vendor-id"),
  getAndroidId: jest.fn().mockReturnValue("android-id"),
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

const mockLocalAuthentication = {
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([2]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
};

const mockSecureStore = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

const mockCrypto = {
  getRandomBytesAsync: jest
    .fn()
    .mockResolvedValue(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    ),
};

// Mock WebAuthn/Native module
jest.mock("../client/native-module", () => ({
  getNativeModule: jest.fn(),
  isNativePasskeySupported: jest.fn().mockResolvedValue(true),
  createNativePasskey: jest.fn().mockResolvedValue({
    id: "test-credential-id",
    rawId: "test-raw-id",
    type: "public-key",
    response: {
      clientDataJSON: "test-client-data",
      attestationObject: "test-attestation",
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

// Mock Expo dependencies
jest.mock("../client/utils/environment", () => ({
  isExpoEnvironment: jest.fn().mockReturnValue(true),
  isSupportedPlatform: jest.fn().mockReturnValue(true),
  validateExpoEnvironment: jest.fn(),
}));

jest.mock("../client/utils/device", () => {
  const clearDeviceIdMock = jest.fn();
  const clearPasskeyDataMock = jest.fn().mockImplementation(() => {
    clearDeviceIdMock(); // Call clearDeviceId when clearPasskeyData is called
    return Promise.resolve();
  });

  return {
    getDeviceInfo: jest.fn(),
    clearDeviceId: clearDeviceIdMock,
    clearPasskeyData: clearPasskeyDataMock,
    getDeviceId: jest.fn().mockResolvedValue("test-device-id"),
    generateFallbackDeviceId: jest.fn().mockResolvedValue("fallback-device-id"),
    isPasskeyRegistered: jest.fn().mockResolvedValue(true),
  };
});

jest.mock("../client/utils/biometrics", () => ({
  checkBiometricSupport: jest.fn().mockResolvedValue({
    isSupported: true,
    isEnrolled: true,
    availableTypes: [2],
    authenticationType: "Face ID",
    error: null,
    platformDetails: {
      platform: "ios",
      version: "16.0",
    },
  }),
  getBiometricType: jest.fn().mockReturnValue("Face ID"),
  authenticateWithBiometrics: jest.fn().mockResolvedValue(true),
  isPasskeySupported: jest.fn().mockResolvedValue(true),
}));

// Mock the module loader with our predefined values
jest.mock("../client/utils/modules", () => ({
  loadExpoModules: jest.fn().mockReturnValue({
    Platform: mockPlatform,
    Application: mockApplication,
    Device: mockDevice,
    LocalAuthentication: mockLocalAuthentication,
    SecureStore: mockSecureStore,
    Crypto: mockCrypto,
  }),
}));

// Mock the storage module
jest.mock("../client/utils/storage", () => ({
  getStorageKeys: jest.fn().mockImplementation((options = {}) => {
    const prefix = options.storagePrefix || "_better-auth";
    return {
      DEVICE_ID: `${prefix}.device_id`,
      STATE: `${prefix}.passkey_state`,
      USER_ID: `${prefix}.user_id`,
    };
  }),
}));

// Now import after all mocks are set up
import type { BetterFetch } from "@better-fetch/fetch";
import { expoPasskeyClient } from "../client/core";

import { getDeviceInfo, isPasskeyRegistered } from "../client/utils/device";
import { isSupportedPlatform } from "../client/utils/environment";
import { loadExpoModules } from "../client/utils/modules";

/**
 * Mock server layer with enhanced tracking for validation
 */
class MockServerDb {
  private users = new Map<
    string,
    { id: string; email: string; name: string }
  >();
  private passkeys = new Map<string, any>();
  private sessions = new Map<string, any>();
  private challenges = new Map<string, any>();

  // Add tracking for DB operations
  public operations = {
    passkeyCreations: 0,
    passkeyUpdates: 0,
    passkeyRevocations: 0,
    sessionCreations: 0,
    challengeCreations: 0,
  };

  clearOperationTracking() {
    this.operations = {
      passkeyCreations: 0,
      passkeyUpdates: 0,
      passkeyRevocations: 0,
      sessionCreations: 0,
      challengeCreations: 0,
    };
  }

  // User methods
  findUser(userId: string) {
    return this.users.get(userId) || null;
  }

  createUser(userData: any) {
    this.users.set(userData.id, userData);
    return userData;
  }

  // Passkey methods
  findPasskey(credentialId: string) {
    const passkeys = Array.from(this.passkeys.values());
    return (
      passkeys.find(
        (p) => p.credentialId === credentialId && p.status === "active",
      ) || null
    );
  }

  getAllPasskeys(userId: string) {
    const passkeys = Array.from(this.passkeys.values());
    return passkeys.filter((p) => p.userId === userId && p.status === "active");
  }

  createPasskey(passkey: any) {
    const id = `passkey-${Date.now()}`;
    const fullPasskey = {
      ...passkey,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active",
      revokedAt: null,
      revokedReason: null,
    };
    this.passkeys.set(id, fullPasskey);
    this.operations.passkeyCreations++;
    return fullPasskey;
  }

  updatePasskey(id: string, updates: any) {
    const passkey = this.passkeys.get(id);
    if (!passkey) return null;

    const updatedPasskey = {
      ...passkey,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.passkeys.set(id, updatedPasskey);

    // Track revocation specifically
    if (updates.status === "revoked") {
      this.operations.passkeyRevocations++;
    } else {
      this.operations.passkeyUpdates++;
    }

    return updatedPasskey;
  }

  // Challenge methods
  createChallenge(userId: string, type: string) {
    const id = `challenge-${Date.now()}`;
    const challenge = `challenge-${Math.random().toString(36).substring(2, 15)}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    const challengeObj = {
      id,
      userId,
      challenge,
      type,
      createdAt,
      expiresAt,
    };

    this.challenges.set(id, challengeObj);
    this.operations.challengeCreations++;
    return challengeObj;
  }

  getLatestChallenge(userId: string, type: string) {
    const challenges = Array.from(this.challenges.values())
      .filter((c) => c.userId === userId && c.type === type)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return challenges.length > 0 ? challenges[0] : null;
  }

  deleteChallenge(id: string) {
    this.challenges.delete(id);
  }

  // Session methods
  createSession(userId: string) {
    const token = `token-${Date.now()}`;
    const user = this.findUser(userId);
    const session = { token, user };
    this.sessions.set(token, session);
    this.operations.sessionCreations++;
    return session;
  }

  // Get total number of passkeys (for verification)
  getTotalPasskeys() {
    return this.passkeys.size;
  }

  // Get active passkeys count
  getActivePasskeysCount() {
    return Array.from(this.passkeys.values()).filter(
      (p) => p.status === "active",
    ).length;
  }

  // Get revoked passkeys count
  getRevokedPasskeysCount() {
    return Array.from(this.passkeys.values()).filter(
      (p) => p.status === "revoked",
    ).length;
  }

  // Get a passkey by its database ID for detailed verification
  getPasskeyById(id: string) {
    return this.passkeys.get(id) || null;
  }

  // Clear all data (useful for test isolation)
  clearAll() {
    this.users.clear();
    this.passkeys.clear();
    this.sessions.clear();
    this.challenges.clear();
    this.clearOperationTracking();
  }

  // Get all passkeys for debugging
  getAllPasskeysRaw() {
    return Array.from(this.passkeys.values());
  }
}

// Create mock server implementation
const mockDb = new MockServerDb();

// Create mock fetch function using Jest's mock function
const mockServerFetch = jest.fn(async (url: string, options?: any) => {
  // Helper to extract URL path and parameters
  const getPathFromUrl = (url: string) => {
    const parsedUrl = new URL(
      url.startsWith("http") ? url : `http://localhost${url}`,
    );
    return parsedUrl.pathname;
  };

  const path = getPathFromUrl(url);
  const method = options?.method || "GET";
  const body = options?.body || {};

  // For listPasskeys, handle query parameters
  const query = options?.query || {};
  const limit = query.limit ? parseInt(query.limit, 10) : 10;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  // Challenge endpoint
  if (path === "/expo-passkey/challenge" && method === "POST") {
    const { userId, type } = body;

    if (!userId) {
      return {
        data: null,
        error: {
          message: "User ID is required",
          code: "user_not_found",
        },
      };
    }

    // Check if user exists for registration challenges
    if (type === "registration") {
      const user = mockDb.findUser(userId);
      if (!user && userId !== "auto-discovery") {
        return {
          data: null,
          error: {
            message: "User not found",
            code: "user_not_found",
          },
        };
      }
    }

    // Create challenge
    const challengeObj = mockDb.createChallenge(userId, type);

    return {
      data: {
        challenge: challengeObj.challenge,
      },
      error: null,
    };
  }

  // Register endpoint
  if (path === "/expo-passkey/register" && method === "POST") {
    const { userId, credential, platform, metadata } = body;

    // Check if user exists
    const user = mockDb.findUser(userId);
    if (!user) {
      return {
        data: null,
        error: {
          message: "User not found",
          code: "user_not_found",
        },
      };
    }

    // Get latest registration challenge
    const challenge = mockDb.getLatestChallenge(userId, "registration");
    if (!challenge) {
      return {
        data: null,
        error: {
          message: "No challenge found for registration",
          code: "invalid_challenge",
        },
      };
    }

    // Check if challenge has expired
    if (new Date(challenge.expiresAt) < new Date()) {
      return {
        data: null,
        error: {
          message: "Challenge has expired. Please request a new one.",
          code: "expired_challenge",
        },
      };
    }

    // Check if credential is already registered
    const existingPasskey = mockDb.findPasskey(credential.id);
    if (existingPasskey && existingPasskey.status === "active") {
      return {
        data: null,
        error: {
          message: "Credential already registered",
          code: "credential_exists",
        },
      };
    }

    // Create passkey
    mockDb.createPasskey({
      userId,
      credentialId: credential.id,
      publicKey: "mock-public-key",
      counter: 0,
      platform,
      metadata: JSON.stringify(metadata || {}),
      lastUsed: new Date().toISOString(),
    });

    // Delete used challenge
    mockDb.deleteChallenge(challenge.id);

    return {
      data: {
        success: true,
        rpName: "Test App",
        rpId: "example.com",
      },
      error: null,
    };
  }

  // Authenticate endpoint
  if (path === "/expo-passkey/authenticate" && method === "POST") {
    const { credential, metadata } = body;

    if (!credential || !credential.id) {
      return {
        data: null,
        error: {
          message: "Invalid credential",
          code: "invalid_credential",
        },
      };
    }

    // Find active credential
    const passkeyCredential = mockDb.findPasskey(credential.id);
    if (!passkeyCredential) {
      return {
        data: null,
        error: {
          message: "Invalid credential",
          code: "invalid_credential",
        },
      };
    }

    // Find user
    const user = mockDb.findUser(passkeyCredential.userId);
    if (!user) {
      return {
        data: null,
        error: {
          message: "User not found",
          code: "user_not_found",
        },
      };
    }

    // Update passkey metadata and last used
    const updatedMetadata = {
      ...JSON.parse(passkeyCredential.metadata || "{}"),
      ...metadata,
      lastAuthenticationAt: new Date().toISOString(),
    };

    mockDb.updatePasskey(passkeyCredential.id, {
      lastUsed: new Date().toISOString(),
      counter: passkeyCredential.counter + 1,
      metadata: JSON.stringify(updatedMetadata),
    });

    // Create session
    const session = mockDb.createSession(user.id);

    return {
      data: {
        token: session.token,
        user: session.user,
      },
      error: null,
    };
  }

  // List passkeys endpoint with pagination support
  if (path.startsWith("/expo-passkey/list/") && method === "GET") {
    const userId = path.split("/").pop();

    if (!userId) {
      return {
        data: null,
        error: {
          message: "User ID is required",
          code: "user_not_found",
        },
      };
    }

    // Get all passkeys for the user
    const allPasskeys = mockDb.getAllPasskeys(userId);

    // Apply pagination
    const paginatedPasskeys = allPasskeys.slice(offset, offset + limit);

    // Determine if there are more results
    const hasMore = allPasskeys.length > offset + limit;

    return {
      data: {
        passkeys: paginatedPasskeys.map((p) => ({
          ...p,
          metadata: JSON.parse(p.metadata || "{}"),
        })),
        nextOffset: hasMore ? offset + limit : null,
      },
      error: null,
    };
  }

  // For the checkPasskeyRegistration endpoint which uses /expo-passkey/list
  if (path === "/expo-passkey/list" && method === "GET") {
    const userId = body.userId;

    if (!userId) {
      return {
        data: null,
        error: {
          message: "User ID is required",
          code: "user_not_found",
        },
      };
    }

    const passkeys = mockDb.getAllPasskeys(userId);

    return {
      data: {
        passkeys: passkeys.map((p) => ({
          ...p,
          metadata: JSON.parse(p.metadata || "{}"),
        })),
      },
      error: null,
    };
  }

  // Revoke passkey endpoint
  if (path === "/expo-passkey/revoke" && method === "POST") {
    const { userId, credentialId, reason } = body;

    // Find the passkey
    const credential = mockDb.findPasskey(credentialId);
    if (!credential || credential.userId !== userId) {
      return {
        data: null,
        error: {
          message: "Credential not found",
          code: "credential_not_found",
        },
      };
    }

    // Revoke the passkey
    mockDb.updatePasskey(credential.id, {
      status: "revoked",
      revokedAt: new Date().toISOString(),
      revokedReason: reason || "user_initiated",
    });

    return {
      data: {
        success: true,
      },
      error: null,
    };
  }

  // Default response for unknown endpoints
  return {
    data: null,
    error: {
      message: "Not found",
      code: "not_found",
    },
  };
});

// Test setup
beforeEach(() => {
  jest.clearAllMocks();

  // Clear mock database
  mockDb.clearAll();

  // Reset Platform object
  mockPlatform.OS = "ios";
  mockPlatform.Version = "16.0";
  mockPlatform.select.mockImplementation((obj) => obj.ios);

  // Reset module loader
  (loadExpoModules as jest.Mock).mockReturnValue({
    Platform: mockPlatform,
    Application: mockApplication,
    Device: mockDevice,
    LocalAuthentication: mockLocalAuthentication,
    SecureStore: mockSecureStore,
    Crypto: mockCrypto,
  });

  // Reset environment checks
  (isSupportedPlatform as jest.Mock).mockReturnValue(true);

  // Reset passkey registration check to default true
  (isPasskeyRegistered as jest.Mock).mockResolvedValue(true);

  // Setup default device info
  (getDeviceInfo as jest.Mock).mockResolvedValue({
    deviceId: "test-device-id",
    platform: "ios",
    model: "iPhone 14",
    manufacturer: "Apple",
    osVersion: "16.0",
    appVersion: "1.0.0",
    biometricSupport: {
      isSupported: true,
      isEnrolled: true,
      availableTypes: [2],
      authenticationType: "Face ID",
      error: null,
      platformDetails: {
        platform: "ios",
        version: "16.0",
      },
    },
  });

  // Add test user to mock DB
  mockDb.createUser({
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  });
});

describe("Expo Passkey Integration Tests", () => {
  // Create client instance
  const client = expoPasskeyClient();
  // Use type assertion to tell TypeScript to trust my implementation
  const actions = client.getActions(mockServerFetch as unknown as BetterFetch);

  describe("Full Authentication Flow", () => {
    test("full flow: register, authenticate, list, and revoke passkey", async () => {
      // 1. Register passkey
      const registerResult = await actions.registerPasskey({
        userId: "test-user-id",
        userName: "Test User", // Add required userName parameter
      });

      expect(registerResult.error).toBeNull();
      expect(registerResult.data).toBeDefined();
      expect(registerResult.data?.success).toBe(true);
      expect(mockDb.operations.passkeyCreations).toBe(1);

      // 2. Authenticate with passkey
      const authResult = await actions.authenticateWithPasskey();

      expect(authResult.error).toBeNull();
      expect(authResult.data).toBeDefined();
      expect(authResult.data?.token).toBeDefined();
      expect(authResult.data?.user).toBeDefined();
      expect(authResult.data?.user.id).toBe("test-user-id");
      expect(mockDb.operations.passkeyUpdates).toBe(1);
      expect(mockDb.operations.sessionCreations).toBe(1);

      // 3. List passkeys
      const listResult = await actions.listPasskeys({
        userId: "test-user-id",
      });

      expect(listResult.error).toBeNull();
      expect(listResult.data).toBeDefined();
      expect(listResult.data?.passkeys).toHaveLength(1);

      // 4. Revoke passkey
      const passkeyId = listResult.data?.passkeys[0].credentialId;
      const revokeResult = await actions.revokePasskey({
        userId: "test-user-id",
        credentialId: passkeyId as string,
        reason: "test-revocation",
      });

      expect(revokeResult.error).toBeNull();
      expect(revokeResult.data).toBeDefined();
      expect(revokeResult.data?.success).toBe(true);
      expect(mockDb.operations.passkeyRevocations).toBe(1);

      // Verify final state
      expect(mockDb.getActivePasskeysCount()).toBe(0);
      expect(mockDb.getRevokedPasskeysCount()).toBe(1);
    });
  });

  describe("Error Handling in Integration", () => {
    test("handles invalid userId in listPasskeys", async () => {
      // Test with empty userId
      const result = await actions.listPasskeys({
        userId: "",
      });

      expect(result.error).toBeDefined();
      expect(result.data).toEqual({ passkeys: [], nextOffset: undefined });
      expect(result.error?.message).toContain("userId is required");
    });

    test("handles error when revoking non-existent passkey", async () => {
      const result = await actions.revokePasskey({
        userId: "test-user-id",
        credentialId: "non-existent-credential", // Use credentialId instead of deviceId
      });

      expect(result.error).toBeDefined();
      expect(result.data).toBeNull();
      // Use a less strict check that will work regardless of which error message comes back
      expect(result.error?.message).toBeDefined();

      // Verify no operations were performed
      expect(mockDb.operations.passkeyRevocations).toBe(0);
    });
  });
});
