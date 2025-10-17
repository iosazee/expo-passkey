/**
 * @file Tests for web-only core implementation
 * @module expo-passkey/client/core.web.test
 */

import type { BetterFetchOption, ErrorContext } from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";
import type {
  ChallengeResponse,
  RegisterPasskeySuccessResponse,
  AuthPasskeySuccessResponse,
  ListPasskeysSuccessResponse,
  ExpoPasskeyClientOptions,
  PasskeyMetadata,
} from "../../types";

// Mock @simplewebauthn/browser before importing
const mockWebAuthnBrowser = {
  browserSupportsWebAuthn: jest.fn(),
  startRegistration: jest.fn(),
  startAuthentication: jest.fn(),
};

jest.mock("@simplewebauthn/browser", () => mockWebAuthnBrowser);

// Mock the web utilities
jest.mock("../utils/web", () => ({
  getWebAuthnBrowser: jest.fn(() => mockWebAuthnBrowser),
  createWebRegistrationOptions: jest.fn(
    (challenge, userId, userName, displayName, rpId, rpName) => ({
      rp: { id: rpId, name: rpName },
      user: { id: userId, name: userName, displayName },
      challenge,
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred",
        residentKey: "preferred",
      },
      attestation: "none",
      excludeCredentials: [],
    }),
  ),
  createWebAuthenticationOptions: jest.fn((challenge, rpId) => ({
    challenge,
    rpId,
    timeout: 60000,
    userVerification: "preferred",
    allowCredentials: [],
  })),
  isWebAuthnSupportedInBrowser: jest.fn(),
  isPlatformAuthenticatorAvailable: jest.fn(),
}));

// Import after mocking
import { expoPasskeyClient } from "../core.web";

describe("core.web - ExpoPasskeyClient", () => {
  const originalWindow = global.window;
  const originalNavigator = global.navigator;

  // Mock $fetch function
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mockFetch completely
    mockFetch.mockReset();

    // Setup browser environment
    Object.defineProperty(global, "window", {
      value: {
        location: {
          hostname: "example.com",
        },
        PublicKeyCredential: jest.fn(),
      },
      writable: true,
    });

    Object.defineProperty(global, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Test Browser)",
        platform: "Test Platform",
      },
      writable: true,
    });

    // Setup default mocks
    require("../utils/web").isWebAuthnSupportedInBrowser.mockReturnValue(true);
    require("../utils/web").isPlatformAuthenticatorAvailable.mockResolvedValue(
      true,
    );
    mockWebAuthnBrowser.startRegistration.mockResolvedValue({
      id: "test-credential-id",
      rawId: "test-raw-id",
      type: "public-key",
      response: {
        clientDataJSON: "test-client-data",
        attestationObject: "test-attestation",
      },
      authenticatorAttachment: "platform",
    });
    mockWebAuthnBrowser.startAuthentication.mockResolvedValue({
      id: "test-credential-id",
      rawId: "test-raw-id",
      type: "public-key",
      response: {
        clientDataJSON: "test-client-data",
        authenticatorData: "test-auth-data",
        signature: "test-signature",
      },
    });
  });

  afterEach(() => {
    global.window = originalWindow;
    global.navigator = originalNavigator;
  });

  describe("plugin initialization", () => {
    it("should create plugin with default options", () => {
      const plugin = expoPasskeyClient();

      expect(plugin.id).toBe("expo-passkey");
      expect(plugin.pathMethods).toEqual({
        "/expo-passkey/challenge": "POST",
        "/expo-passkey/register": "POST",
        "/expo-passkey/authenticate": "POST",
        "/expo-passkey/list/:userId": "GET",
        "/expo-passkey/revoke": "POST",
      });
    });

    it("should create plugin with custom options", () => {
      const options: ExpoPasskeyClientOptions = {
        storagePrefix: "_custom-auth",
        timeout: 30000,
      };

      const plugin = expoPasskeyClient(options);
      const actions = plugin.getActions(mockFetch);

      expect(plugin.id).toBe("expo-passkey");
      // The options are used internally, so we test through behavior
      expect(actions).toBeDefined();
    });

    it("should implement BetterAuthClientPlugin interface", () => {
      const plugin: BetterAuthClientPlugin = expoPasskeyClient();

      expect(typeof plugin.id).toBe("string");
      expect(typeof plugin.getActions).toBe("function");
      expect(typeof plugin.pathMethods).toBe("object");
      expect(Array.isArray(plugin.fetchPlugins)).toBe(true);
    });
  });

  describe("getChallenge action", () => {
    it("should successfully get challenge", async () => {
      const challengeResponse: ChallengeResponse = {
        challenge: "test-challenge-123",
      };

      mockFetch.mockResolvedValueOnce({
        data: challengeResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.getChallenge({
        userId: "user123",
        type: "registration",
      });

      expect(result.data).toEqual(challengeResponse);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith("/expo-passkey/challenge", {
        method: "POST",
        body: {
          userId: "user123",
          type: "registration",
        },
      });
    });

    it("should handle challenge error", async () => {
      const error = {
        message: "Challenge generation failed",
        statusText: "Internal Server Error",
      };

      mockFetch.mockResolvedValueOnce({
        data: null,
        error,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.getChallenge({
        userId: "user123",
        type: "authentication",
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain("Challenge generation failed");
    });

    it("should handle fetch options", async () => {
      const challengeResponse: ChallengeResponse = {
        challenge: "test-challenge",
      };

      mockFetch.mockResolvedValueOnce({
        data: challengeResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const fetchOptions: BetterFetchOption = {
        headers: { "Custom-Header": "test" },
      };

      await actions.getChallenge(
        {
          userId: "user123",
          type: "registration",
        },
        fetchOptions,
      );

      expect(mockFetch).toHaveBeenCalledWith("/expo-passkey/challenge", {
        method: "POST",
        body: {
          userId: "user123",
          type: "registration",
        },
        headers: { "Custom-Header": "test" },
      });
    });
  });

  describe("registerPasskey action", () => {
    it("should successfully register passkey", async () => {
      // Mock successful challenge response first
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "test-challenge" },
        error: null,
      });

      // Then mock successful registration response
      mockFetch.mockResolvedValueOnce({
        data: {
          success: true,
          rpName: "Test App",
          rpId: "example.com",
        } as RegisterPasskeySuccessResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.registerPasskey({
        userId: "user123",
        userName: "testuser",
        displayName: "Test User",
        rpName: "Test App",
        rpId: "example.com",
      });

      expect(result.data).toEqual({
        success: true,
        rpName: "Test App",
        rpId: "example.com",
      });
      expect(result.error).toBeNull();

      // Verify WebAuthn was called
      expect(mockWebAuthnBrowser.startRegistration).toHaveBeenCalled();

      // Verify server calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        "/expo-passkey/challenge",
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "/expo-passkey/register",
        expect.any(Object),
      );
    });

    it("should handle WebAuthn not supported", async () => {
      require("../utils/web").isWebAuthnSupportedInBrowser.mockReturnValue(
        false,
      );

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.registerPasskey({
        userId: "user123",
        userName: "testuser",
        rpName: "Test App",
        rpId: "example.com",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("WebAuthn is not supported");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle challenge failure", async () => {
      mockFetch.mockResolvedValueOnce({
        data: null,
        error: { message: "Challenge failed" },
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.registerPasskey({
        userId: "user123",
        userName: "testuser",
        rpName: "Test App",
        rpId: "example.com",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Challenge failed");
    });

    it("should handle WebAuthn registration failure", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "test-challenge" },
        error: null,
      });

      mockWebAuthnBrowser.startRegistration.mockRejectedValueOnce(
        new Error("User cancelled"),
      );

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.registerPasskey({
        userId: "user123",
        userName: "testuser",
        rpName: "Test App",
        rpId: "example.com",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("User cancelled");
    });

    it("should handle custom options", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "test-challenge" },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        data: {
          success: true,
          rpName: "Test App",
          rpId: "example.com",
        } as RegisterPasskeySuccessResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const customMetadata: Partial<PasskeyMetadata> = {
        deviceName: "Custom Device",
        lastLocation: "test-page",
      };

      await actions.registerPasskey({
        userId: "user123",
        userName: "testuser",
        displayName: "Test User",
        rpName: "Test App",
        rpId: "example.com",
        attestation: "direct",
        authenticatorSelection: {
          authenticatorAttachment: "cross-platform",
          userVerification: "required",
        },
        timeout: 30000,
        metadata: customMetadata,
      });

      const createOptionsCall =
        require("../utils/web").createWebRegistrationOptions.mock.calls[0];
      const options = createOptionsCall[6];

      expect(options.attestation).toBe("direct");
      expect(options.authenticatorSelection.authenticatorAttachment).toBe(
        "cross-platform",
      );
      expect(options.timeout).toBe(30000);

      // Check registration request body
      const registerCall = mockFetch.mock.calls[1];
      expect(registerCall[1].body.metadata.deviceName).toBe("Custom Device");
    });
  });

  describe("authenticateWithPasskey action", () => {
    it("should successfully authenticate with passkey", async () => {
      // Mock successful responses in the correct order
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "auth-challenge" },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        data: {
          token: "auth-token",
          user: { id: "user123", email: "test@example.com" },
        } as AuthPasskeySuccessResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.authenticateWithPasskey({
        userId: "user123",
        rpId: "example.com",
      });

      expect(result.data).toEqual({
        token: "auth-token",
        user: { id: "user123", email: "test@example.com" },
      });
      expect(result.error).toBeNull();

      expect(mockWebAuthnBrowser.startAuthentication).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle authentication without userId (auto-discovery)", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "auth-challenge" },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        data: {
          token: "auth-token",
          user: { id: "user123", email: "test@example.com" },
        } as AuthPasskeySuccessResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      await actions.authenticateWithPasskey();

      // Check that challenge was requested with auto-discovery
      const challengeCall = mockFetch.mock.calls[0];
      expect(challengeCall[1].body.userId).toBe("auto-discovery");
    });

    it("should handle WebAuthn not supported", async () => {
      require("../utils/web").isWebAuthnSupportedInBrowser.mockReturnValue(
        false,
      );

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.authenticateWithPasskey();

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("WebAuthn is not supported");
    });

    it("should handle WebAuthn authentication failure", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "auth-challenge" },
        error: null,
      });

      mockWebAuthnBrowser.startAuthentication.mockRejectedValueOnce(
        new Error("Authentication failed"),
      );

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.authenticateWithPasskey();

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Authentication failed");
    });

    it("should handle server authentication failure", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "auth-challenge" },
        error: null,
      });

      // Fix: Use an error that has proper message and statusText properties
      const authError = {
        message: "Invalid credential",
        statusText: "Unauthorized",
      };

      mockFetch.mockResolvedValueOnce({
        data: null,
        error: authError,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.authenticateWithPasskey();

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Invalid credential");
    });

    it("should use custom options", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "auth-challenge" },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        data: {
          token: "auth-token",
          user: { id: "user123", email: "test@example.com" },
        } as AuthPasskeySuccessResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const customMetadata: Partial<PasskeyMetadata> = {
        lastLocation: "custom-location",
        deviceName: "Test Device",
      };

      await actions.authenticateWithPasskey({
        userId: "user123",
        rpId: "custom.com",
        timeout: 45000,
        userVerification: "required",
        metadata: customMetadata,
      });

      const createOptionsCall =
        require("../utils/web").createWebAuthenticationOptions.mock.calls[0];
      expect(createOptionsCall[1]).toBe("custom.com");
      expect(createOptionsCall[2].timeout).toBe(45000);
      expect(createOptionsCall[2].userVerification).toBe("required");

      const authCall = mockFetch.mock.calls[1];
      expect(authCall[1].body.metadata.lastLocation).toBe("custom-location");
    });
  });

  describe("listPasskeys action", () => {
    it("should successfully list passkeys", async () => {
      const passkeysResponse: ListPasskeysSuccessResponse = {
        passkeys: [
          {
            id: "pk1",
            userId: "user123",
            credentialId: "cred1",
            platform: "web",
            lastUsed: "2023-01-01T00:00:00Z",
            status: "active" as const,
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: "2023-01-01T00:00:00Z",
            metadata: {},
          },
        ],
        nextOffset: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        data: passkeysResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.listPasskeys({
        userId: "user123",
        limit: 10,
        offset: 0,
      });

      expect(result.data).toEqual(passkeysResponse);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith("/expo-passkey/list/user123", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        query: {
          limit: "10",
          offset: "0",
        },
      });
    });

    it("should handle missing userId", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.listPasskeys({
        userId: "",
      });

      expect(result.data?.passkeys).toEqual([]);
      expect(result.error?.message).toContain("userId is required");
    });

    it("should handle list failure", async () => {
      mockFetch.mockResolvedValueOnce({
        data: null,
        error: { message: "Access denied", statusText: "Forbidden" },
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.listPasskeys({
        userId: "user123",
      });

      expect(result.data?.passkeys).toEqual([]);
      expect(result.error?.message).toContain("Access denied");
    });
  });

  describe("revokePasskey action", () => {
    it("should successfully revoke passkey", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.revokePasskey({
        credentialId: "cred123",
        reason: "Device lost",
      });

      expect(result.data).toEqual({ success: true });
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith("/expo-passkey/revoke", {
        method: "POST",
        body: {
          credentialId: "cred123",
          reason: "Device lost",
        },
      });
    });

    it("should handle revocation failure", async () => {
      mockFetch.mockResolvedValueOnce({
        data: null,
        error: { message: "Passkey not found", statusText: "Not Found" },
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.revokePasskey({
        credentialId: "cred123",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Passkey not found");
    });

    it("should handle server returning unsuccessful result", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { success: false },
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.revokePasskey({
        credentialId: "cred123",
      });

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Failed to revoke passkey");
    });
  });

  describe("checkPasskeyRegistration action", () => {
    it("should check registration with WebAuthn supported", async () => {
      const passkeysResponse: ListPasskeysSuccessResponse = {
        passkeys: [
          {
            id: "pk1",
            userId: "user123",
            credentialId: "cred1",
            platform: "web",
            lastUsed: "2023-01-01T00:00:00Z",
            status: "active" as const,
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: "2023-01-01T00:00:00Z",
            metadata: {},
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        data: passkeysResponse,
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.checkPasskeyRegistration("user123");

      expect(result.isRegistered).toBe(true);
      expect(result.credentialIds).toEqual(["cred1"]);
      expect(result.biometricSupport).toBeNull(); // Not applicable for web
      expect(result.error).toBeNull();
    });

    it("should handle WebAuthn not supported", async () => {
      require("../utils/web").isWebAuthnSupportedInBrowser.mockReturnValue(
        false,
      );

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.checkPasskeyRegistration("user123");

      expect(result.isRegistered).toBe(false);
      expect(result.credentialIds).toEqual([]);
      expect(result.error?.message).toContain("WebAuthn not supported");
    });

    it("should handle no passkeys found", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { passkeys: [] },
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.checkPasskeyRegistration("user123");

      expect(result.isRegistered).toBe(false);
      expect(result.credentialIds).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe("utility actions", () => {
    it("should check if passkey is supported", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.isPasskeySupported();

      expect(result).toBe(true);
      expect(
        require("../utils/web").isWebAuthnSupportedInBrowser,
      ).toHaveBeenCalled();
    });

    it("should return null for getBiometricInfo (not applicable for web)", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.getBiometricInfo();

      expect(result).toBeNull();
    });

    it("should get device info", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.getDeviceInfo();

      expect(result.platform).toBe("web");
      expect(result.model).toBe("Mozilla/5.0 (Test Browser)");
      expect(result.osVersion).toBe("Test Platform");
    });

    it("should return null for getStorageKeys (not applicable for web)", () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = actions.getStorageKeys();

      expect(result).toBeNull();
    });

    it("should return false for hasPasskeysRegistered (not applicable for web)", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.hasPasskeysRegistered();

      expect(result).toBe(false);
    });

    it("should return false for hasUserPasskeysRegistered (not applicable for web)", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.hasUserPasskeysRegistered("user123");

      expect(result).toBe(false);
    });

    it("should be no-op for removeLocalCredential (not applicable for web)", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      // Should not throw
      await actions.removeLocalCredential("cred123");
    });

    it("should check if platform authenticator is available", async () => {
      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.isPlatformAuthenticatorAvailable();

      expect(result).toBe(true);
      expect(
        require("../utils/web").isPlatformAuthenticatorAvailable,
      ).toHaveBeenCalled();
    });
  });

  describe("fetch plugins", () => {
    it("should include fetch plugin with correct metadata", () => {
      const plugin = expoPasskeyClient();

      expect(plugin.fetchPlugins).toHaveLength(1);
      const fetchPlugin = plugin.fetchPlugins[0];

      expect(fetchPlugin.id).toBe("expo-passkey-plugin");
      expect(fetchPlugin.name).toBe("Expo Passkey Plugin");
      expect(fetchPlugin.version).toBe("2.0.0");
    });

    it("should handle error in onError hook", async () => {
      const plugin = expoPasskeyClient();
      const fetchPlugin = plugin.fetchPlugins[0];

      // Create a minimal mock Response object using unknown cast for type safety
      const mockResponse = {
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers(),
        ok: false,
        redirected: false,
        url: "https://example.com/api",
        type: "basic" as ResponseType,
        body: null,
        bodyUsed: false,
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
        blob: jest.fn().mockResolvedValue(new Blob()),
        formData: jest.fn().mockResolvedValue(new FormData()),
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn().mockResolvedValue(""),
        clone: jest.fn().mockReturnThis(),
      } as unknown as Response;

      const mockContext: ErrorContext = {
        response: mockResponse,
        request: {
          url: "https://example.com/api",
          method: "POST",
          headers: new Headers(),
        } as any,
        error: {
          message: "Unauthorized access",
          name: "AuthError",
        } as any,
      };

      // Should not throw and should handle the error gracefully
      await expect(
        fetchPlugin.hooks.onError(mockContext),
      ).resolves.not.toThrow();
    });

    it("should add custom headers in init hook", async () => {
      const plugin = expoPasskeyClient();
      const fetchPlugin = plugin.fetchPlugins[0];

      const result = await fetchPlugin.init("https://example.com/api", {
        method: "POST",
        headers: { "Existing-Header": "value" },
      });

      expect(result.url).toBe("https://example.com/api");
      expect(result.options).toBeDefined();
      expect(result.options?.headers).toMatchObject({
        "Existing-Header": "value",
        "X-Client-Type": "expo-passkey-web",
        "X-Client-Version": "2.0.0",
        "X-Platform": "web",
        "X-Platform-Version": "Test Platform",
      });
    });

    it("should handle different header formats", async () => {
      const plugin = expoPasskeyClient();
      const fetchPlugin = plugin.fetchPlugins[0];

      // Test with mock Headers object that has forEach - fix the mock implementation
      const mockHeaders = {
        forEach: jest.fn((callback) => {
          // Call the callback with value first, then key (standard forEach pattern for Headers)
          callback("test-value", "Test-Header");
        }),
      };

      const result = await fetchPlugin.init("https://example.com/api", {
        headers: mockHeaders as any,
      });

      expect(result.options).toBeDefined();
      expect(result.options?.headers).toBeDefined();
      const resultHeaders = result.options?.headers as Record<string, string>;
      expect(resultHeaders["Test-Header"]).toBe("test-value");
      expect(resultHeaders["X-Client-Type"]).toBe("expo-passkey-web");
    });

    it("should handle array headers", async () => {
      const plugin = expoPasskeyClient();
      const fetchPlugin = plugin.fetchPlugins[0];

      const result = await fetchPlugin.init("https://example.com/api", {
        headers: [["Content-Type", "application/json"]],
      });

      expect(result.options).toBeDefined();
      expect(result.options?.headers).toBeDefined();
      const resultHeaders = result.options?.headers as Record<string, string>;
      expect(resultHeaders["Content-Type"]).toBe("application/json");
      expect(resultHeaders["X-Client-Type"]).toBe("expo-passkey-web");
    });

    it("should handle error in init hook gracefully", async () => {
      // Create plugin
      const plugin = expoPasskeyClient();
      const fetchPlugin = plugin.fetchPlugins[0];

      // Spy on console.warn
      const consoleSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Force an error by setting navigator to a problematic value
      const originalNavigator = global.navigator;
      // @ts-expect-error - Force an error by setting navigator to null
      global.navigator = null;

      const result = await fetchPlugin.init("https://example.com/api", {
        method: "POST",
      });

      expect(result.url).toBe("https://example.com/api");
      expect(result.options).toBeDefined();
      expect(result.options?.method).toBe("POST");
      expect(result.options?.headers).toBeDefined();

      // Should have warned about the error
      expect(consoleSpy).toHaveBeenCalledWith(
        "[ExpoPasskey] Could not add custom headers:",
        expect.any(Error),
      );

      // Restore
      global.navigator = originalNavigator;
      consoleSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      mockFetch.mockReset().mockRejectedValueOnce(new Error("Network error"));

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.getChallenge({
        userId: "user123",
        type: "registration",
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("Network error");
    });

    it("should handle non-Error objects", async () => {
      mockFetch.mockReset().mockRejectedValueOnce("String error");

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.getChallenge({
        userId: "user123",
        type: "registration",
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe("String error");
    });
  });

  describe("environment checks", () => {
    it("should handle missing window object", () => {
      // @ts-expect-error - intentionally setting to undefined for testing
      global.window = undefined;

      require("../utils/web").isWebAuthnSupportedInBrowser.mockReturnValue(
        false,
      );

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      expect(actions).toBeDefined();
    });

    it("should handle missing navigator object", async () => {
      // @ts-expect-error - intentionally setting to undefined for testing
      global.navigator = undefined;

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const deviceInfo = await actions.getDeviceInfo();

      expect(deviceInfo.model).toBe("Unknown Browser");
      expect(deviceInfo.osVersion).toBe("Unknown OS");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete registration flow", async () => {
      // Setup successful mocks for complete flow
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "reg-challenge" },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        data: {
          success: true,
          rpName: "Test App",
          rpId: "example.com",
        },
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const metadata: Partial<PasskeyMetadata> = {
        deviceName: "Test Browser",
        lastLocation: "registration-page",
      };

      const result = await actions.registerPasskey({
        userId: "user123",
        userName: "testuser",
        displayName: "Test User",
        rpName: "Test App",
        rpId: "example.com",
        metadata,
      });

      expect(result.data?.success).toBe(true);
      expect(mockWebAuthnBrowser.startRegistration).toHaveBeenCalledWith({
        optionsJSON: expect.objectContaining({
          rp: { id: "example.com", name: "Test App" },
          user: expect.objectContaining({
            name: "testuser",
            displayName: "Test User",
          }),
        }),
      });
    });

    it("should handle complete authentication flow", async () => {
      mockFetch.mockResolvedValueOnce({
        data: { challenge: "auth-challenge" },
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        data: {
          token: "auth-token",
          user: { id: "user123", email: "test@example.com" },
        },
        error: null,
      });

      const plugin = expoPasskeyClient();
      const actions = plugin.getActions(mockFetch);

      const result = await actions.authenticateWithPasskey({
        userId: "user123",
        rpId: "example.com",
      });

      expect(result.data?.token).toBe("auth-token");
      expect(result.data?.user.id).toBe("user123");
      expect(mockWebAuthnBrowser.startAuthentication).toHaveBeenCalledWith({
        optionsJSON: expect.objectContaining({
          rpId: "example.com",
        }),
      });
    });
  });
});
