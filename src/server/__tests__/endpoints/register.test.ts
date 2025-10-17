import { APIError } from "better-call";

// Mock WebAuthn at the top level before any imports
jest.mock("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: jest.fn(),
  isoBase64URL: {
    fromBuffer: jest.fn((_buffer) => "mocked-base64url"),
  },
}));

import { createRegisterEndpoint } from "../../../server/endpoints/register";
import type { ResolvedSchemaConfig } from "../../../types/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";

// Mock the logger
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

describe("registerPasskey endpoint", () => {
  // Setup options for the endpoint
  const options = {
    rpName: "Test App",
    rpId: "example.com",
    origin: ["https://example.com", "example://"], // Add required origin property
    logger: mockLogger,
    schemaConfig: defaultSchemaConfig, // Add required schemaConfig
  };

  // Mock request context - create fresh mocks for each test
  let mockCtx: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock context for each test
    mockCtx = {
      body: {
        credential: {
          id: "test-credential-id",
          rawId: "test-raw-id",
          type: "public-key",
          response: {
            clientDataJSON: "test-client-data",
            attestationObject: "test-attestation",
            transports: ["internal"],
          },
          authenticatorAttachment: "platform",
        },
        platform: "ios",
        metadata: {
          deviceName: "iPhone Test",
        },
      },
      context: {
        adapter: {
          findOne: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        generateId: jest.fn(() => "generated-id"),
        session: {
          user: {
            id: "user-123",
          },
        },
      },
      json: jest.fn(),
    };
  });

  it("should handle database errors gracefully", async () => {
    // Mock user exists but database error occurs
    mockCtx.context.adapter.findOne
      .mockResolvedValueOnce({ id: "user-123" }) // User exists
      .mockResolvedValueOnce(null); // No existing credential

    // Mock findMany to return a valid challenge
    mockCtx.context.adapter.findMany.mockResolvedValueOnce([
      {
        id: "challenge-id",
        userId: "user-123",
        challenge: "test-challenge",
        type: "registration",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      },
    ]);

    // Mock create to throw error
    mockCtx.context.adapter.create.mockRejectedValueOnce(
      new Error("Database error")
    );

    // Create endpoint and get handler using type assertion
    const endpoint = createRegisterEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx)).rejects.toThrow(APIError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Registration error:",
      expect.any(Error)
    );
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

    // Mock user exists
    mockCtx.context.adapter.findOne.mockResolvedValueOnce({ id: "user-123" });

    // Mock challenge query to return a valid challenge
    mockCtx.context.adapter.findMany
      .mockResolvedValueOnce([
        {
          id: "challenge-id",
          userId: "user-123",
          challenge: "test-challenge",
          type: "registration",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        },
      ]) // First call for challenges
      .mockResolvedValueOnce([]); // Second call for existing credentials (empty array)

    // Mock WebAuthn verification to succeed so we can test both model names
    (verifyRegistrationResponse as jest.Mock).mockResolvedValueOnce({
      verified: true,
      registrationInfo: {
        credential: {
          id: "test-credential-id",
          publicKey: "test-public-key",
        },
        aaguid: "test-aaguid",
      },
    });

    // Mock database operations to fail at the create step so we can see both findMany calls
    mockCtx.context.adapter.create.mockRejectedValueOnce(
      new Error("Database error")
    );

    // Create endpoint with custom schema config
    const endpoint = createRegisterEndpoint(customOptions);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw due to database error
    await expect(handler(mockCtx)).rejects.toThrow(APIError);

    // Verify findMany was called with custom challenge model name (first call)
    expect(mockCtx.context.adapter.findMany).toHaveBeenNthCalledWith(1, {
      model: "customChallengeTable",
      where: [
        { field: "userId", operator: "eq", value: "user-123" },
        { field: "type", operator: "eq", value: "registration" },
      ],
      sortBy: { field: "createdAt", direction: "desc" },
      limit: 1,
    });

    // Verify findMany was also called with custom passkey model name for existing credential check (second call)
    expect(mockCtx.context.adapter.findMany).toHaveBeenNthCalledWith(2, {
      model: "customPasskeyTable",
      where: [
        {
          field: "credentialId",
          operator: "eq",
          value: "test-credential-id",
        },
      ],
      limit: 1,
    });

    // Verify both calls were made
    expect(mockCtx.context.adapter.findMany).toHaveBeenCalledTimes(2);
  });
});
