import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { APIError } from "better-call";

import { createAuthenticateEndpoint } from "../../../server/endpoints/authenticate";
import type { ResolvedSchemaConfig } from "../../../types/server";

// Mock dependencies
jest.mock("better-auth/cookies", () => ({
  setSessionCookie: jest.fn(),
  setCookieCache: jest.fn(),
}));

jest.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: jest.fn(),
}));

jest.mock("@simplewebauthn/server/helpers", () => ({
  isoBase64URL: {
    toBuffer: jest.fn().mockReturnValue(Buffer.from("mock-public-key")),
  },
}));

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Default schema config
const defaultSchemaConfig: ResolvedSchemaConfig = {
  authPasskeyModel: "authPasskey",
  passkeyChallengeModel: "passkeyChallenge",
};

type EndpointHandler = (ctx: any) => Promise<any>;

describe("authenticatePasskey endpoint", () => {
  // Setup options for the endpoint
  const options = {
    logger: mockLogger,
    rpId: "example.com", // Add required rpId property
    origin: ["https://example.com", "example://"], // Add required origin property
    schemaConfig: defaultSchemaConfig, // Add required schemaConfig
  };

  // Mock request context
  const mockCtx = {
    body: {
      credential: {
        // Update to use credential instead of deviceId
        id: "test-credential-id",
        rawId: "test-raw-id",
        type: "public-key",
        response: {
          clientDataJSON: "test-client-data",
          authenticatorData: "test-auth-data",
          signature: "test-signature",
          userHandle: "test-user-handle",
        },
      },
      metadata: {
        lastLocation: "mobile-app",
        appVersion: "1.0.0",
      },
    },
    request: {
      headers: {
        get: jest.fn((header) => {
          if (header === "user-agent") {return "test-user-agent";}
          if (header === "x-forwarded-for") {return "127.0.0.1";}
          return null;
        }),
      },
    },
    context: {
      adapter: {
        findOne: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "challenge-id",
            userId: "user-123",
            challenge: "test-challenge",
            type: "authentication",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
          },
        ]),
        update: jest.fn(),
        delete: jest.fn(),
      },
      internalAdapter: {
        createSession: jest.fn().mockResolvedValue({
          token: "test-session-token",
        }),
      },
      options: {
        session: {
          cookieCache: {
            enabled: true,
          },
          expiresIn: 604800, // 7 days
        },
      },
    },
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle unexpected errors gracefully", async () => {
    // Mock database error
    mockCtx.context.adapter.findOne.mockRejectedValueOnce(
      new Error("Database connection error"),
    );

    // Create endpoint and get handler using type assertion
    const endpoint = createAuthenticateEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx as any)).rejects.toThrow(APIError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Authentication error:",
      expect.any(Error),
    );
  });

  describe("metadata parsing", () => {
    const mockPasskey = {
      id: "passkey-id",
      userId: "user-123",
      credentialId: "test-credential-id",
      publicKey: "base64-encoded-key",
      counter: 0,
      status: "active",
      metadata: '{"deviceName":"iPhone 14"}',
    };

    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      emailVerified: true,
    };

    const mockChallenge = {
      id: "challenge-id",
      userId: "user-123",
      challenge: "test-challenge",
      type: "authentication",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    };

    function setupFullFlowMocks(passkey: typeof mockPasskey) {
      // findOne: first call returns passkey, second call returns user
      mockCtx.context.adapter.findOne
        .mockResolvedValueOnce(passkey)
        .mockResolvedValueOnce(mockUser);

      // findMany: user challenges, then auto-discovery challenges
      mockCtx.context.adapter.findMany
        .mockResolvedValueOnce([mockChallenge])
        .mockResolvedValueOnce([]);

      // verifyAuthenticationResponse
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValueOnce({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      // update and delete
      mockCtx.context.adapter.update.mockResolvedValueOnce({});
      mockCtx.context.adapter.delete.mockResolvedValueOnce({});
    }

    it("should handle corrupted metadata without crashing authentication", async () => {
      const passkeyWithCorruptedMetadata = {
        ...mockPasskey,
        metadata: "not-valid-json",
      };

      setupFullFlowMocks(passkeyWithCorruptedMetadata);

      const endpoint = createAuthenticateEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      await handler(mockCtx as any);

      // Should warn about corrupted metadata
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to parse existing passkey metadata, resetting:",
        expect.objectContaining({ credentialId: "test-credential-id" }),
      );

      // Should still update the passkey with new metadata (falling back to empty existing)
      expect(mockCtx.context.adapter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            metadata: expect.any(String),
          }),
        }),
      );

      // Verify the saved metadata contains body metadata but not the corrupted data
      const updateCall = mockCtx.context.adapter.update.mock.calls[0][0];
      const savedMetadata = JSON.parse(updateCall.update.metadata);
      expect(savedMetadata).toEqual(
        expect.objectContaining({
          lastLocation: "mobile-app",
          appVersion: "1.0.0",
          lastAuthenticationAt: expect.any(String),
        }),
      );

      // Authentication should still succeed
      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "test-session-token",
          user: expect.objectContaining({ id: "user-123" }),
        }),
      );
    });

    it("should preserve valid existing metadata during authentication", async () => {
      setupFullFlowMocks(mockPasskey);

      const endpoint = createAuthenticateEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      await handler(mockCtx as any);

      // No warnings should be logged
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Verify the saved metadata merges existing + new
      const updateCall = mockCtx.context.adapter.update.mock.calls[0][0];
      const savedMetadata = JSON.parse(updateCall.update.metadata);
      expect(savedMetadata).toEqual(
        expect.objectContaining({
          deviceName: "iPhone 14", // preserved from existing
          lastLocation: "mobile-app", // from request body
          appVersion: "1.0.0", // from request body
          lastAuthenticationAt: expect.any(String),
        }),
      );
    });

    it("should handle null metadata without crashing authentication", async () => {
      const passkeyWithNullMetadata = {
        ...mockPasskey,
        metadata: null,
      };

      setupFullFlowMocks(passkeyWithNullMetadata as any);

      const endpoint = createAuthenticateEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      await handler(mockCtx as any);

      // No warnings for null metadata
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Should still update with request body metadata
      const updateCall = mockCtx.context.adapter.update.mock.calls[0][0];
      const savedMetadata = JSON.parse(updateCall.update.metadata);
      expect(savedMetadata).toEqual(
        expect.objectContaining({
          lastLocation: "mobile-app",
          appVersion: "1.0.0",
          lastAuthenticationAt: expect.any(String),
        }),
      );
    });
  });

  it("should use custom schema config model names", async () => {
    const customSchemaConfig: ResolvedSchemaConfig = {
      authPasskeyModel: "customPasskeyTable",
      passkeyChallengeModel: "customChallengeTable",
    };

    const customOptions = {
      ...options,
      schemaConfig: customSchemaConfig,
    };

    // Mock database error to see which model name is used
    mockCtx.context.adapter.findOne.mockRejectedValueOnce(
      new Error("Database connection error"),
    );

    // Create endpoint with custom schema config
    const endpoint = createAuthenticateEndpoint(customOptions);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx as any)).rejects.toThrow(APIError);

    // Verify findOne was called with custom model name
    expect(mockCtx.context.adapter.findOne).toHaveBeenCalledWith({
      model: "customPasskeyTable",
      where: [
        { field: "credentialId", operator: "eq", value: "test-credential-id" },
        { field: "status", operator: "eq", value: "active" },
      ],
    });
  });
});
