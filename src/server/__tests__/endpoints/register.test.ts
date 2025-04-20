import { APIError } from "better-call";

import { createRegisterEndpoint } from "../../../server/endpoints/register";

// Mock the logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

type EndpointHandler = (ctx: any) => Promise<any>;

describe("registerPasskey endpoint", () => {
  // Setup options for the endpoint
  const options = {
    rpName: "Test App",
    rpId: "example.com",
    origin: ["https://example.com", "example://"], // Add required origin property
    logger: mockLogger,
  };

  // Mock request context
  const mockCtx = {
    body: {
      userId: "user-123",
      credential: {
        // Update to use credential instead of deviceId
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
        findMany: jest.fn().mockResolvedValue([
          {
            id: "challenge-id",
            userId: "user-123",
            challenge: "test-challenge",
            type: "registration",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 300000).toISOString(),
          },
        ]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      generateId: jest.fn(() => "generated-id"),
    },
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle database errors gracefully", async () => {
    // Mock user exists but database error occurs
    mockCtx.context.adapter.findOne
      .mockResolvedValueOnce({ id: "user-123" }) // User exists
      .mockResolvedValueOnce(null); // No existing credential

    // Mock create to throw error
    mockCtx.context.adapter.create.mockRejectedValueOnce(
      new Error("Database error"),
    );

    // Create endpoint and get handler using type assertion
    const endpoint = createRegisterEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx)).rejects.toThrow(APIError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Registration error:",
      expect.any(Error),
    );
  });
});
