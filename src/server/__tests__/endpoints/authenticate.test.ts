import { APIError } from "better-call";

import { createAuthenticateEndpoint } from "../../../server/endpoints/authenticate";

// Mock dependencies
jest.mock("better-auth/cookies", () => ({
  setSessionCookie: jest.fn(),
  setCookieCache: jest.fn(),
}));

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

type EndpointHandler = (ctx: any) => Promise<any>;

describe("authenticatePasskey endpoint", () => {
  // Setup options for the endpoint
  const options = {
    logger: mockLogger,
    rpId: "example.com", // Add required rpId property
    origin: ["https://example.com", "example://"], // Add required origin property
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
          if (header === "user-agent") return "test-user-agent";
          if (header === "x-forwarded-for") return "127.0.0.1";
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
});
