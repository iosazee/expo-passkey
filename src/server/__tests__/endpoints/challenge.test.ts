import { APIError } from "better-call";
import { createChallengeEndpoint } from "../../../server/endpoints/challenge";
import type { ResolvedSchemaConfig } from "../../../types/server";

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

// Create a mock session fetcher
const mockSessionFetcher = jest.fn();

type EndpointHandler = (ctx: any) => Promise<any>;

describe("challenge endpoint", () => {
  const options = {
    logger: mockLogger,
    schemaConfig: defaultSchemaConfig,
    _sessionFetcher: mockSessionFetcher,
  };

  let mockCtx: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create fresh mock context for each test
    mockCtx = {
      body: {},
      request: {
        headers: {
          get: jest.fn(() => "session-cookie-value"),
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
        generateId: jest.fn(() => "generated-challenge-id"),
        session: {
          user: {
            id: "user-123",
            email: "test@example.com",
          },
        },
      },
      json: jest.fn((data) => data),
    };

    // Configure mock session fetcher to return session from mockCtx
    mockSessionFetcher.mockImplementation(async () => mockCtx.context.session);
  });

  describe("registration challenges", () => {
    it("should generate registration challenge when user is authenticated", async () => {
      // Mock user exists in database
      mockCtx.context.adapter.findOne.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
      });

      // Mock challenge creation
      mockCtx.context.adapter.create.mockResolvedValueOnce({
        id: "generated-challenge-id",
        userId: "user-123",
        challenge: expect.any(String),
        type: "registration",
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
      });

      // Set request body for registration challenge
      mockCtx.body = {
        type: "registration",
        registrationOptions: {
          timeout: 60000,
        },
      };

      // Get the endpoint handler
      const endpoint = createChallengeEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      // Call the handler
      const result = await handler(mockCtx);

      // Verify session user was used (not from request body)
      expect(mockCtx.context.adapter.findOne).toHaveBeenCalledWith({
        model: "user",
        where: [{ field: "id", operator: "eq", value: "user-123" }],
      });

      // Verify challenge was created with session userId
      expect(mockCtx.context.adapter.create).toHaveBeenCalledWith({
        model: "passkeyChallenge",
        data: expect.objectContaining({
          userId: "user-123", // Should use session userId
          type: "registration",
        }),
        forceAllowId: true,
      });

      // Verify response contains challenge
      expect(result).toEqual({
        challenge: expect.any(String),
      });
    });

    it("should reject registration challenge when user is not authenticated", async () => {
      // Remove session to simulate unauthenticated request
      mockCtx.context.session = undefined;

      mockCtx.body = {
        type: "registration",
      };

      const endpoint = createChallengeEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      // Should throw UNAUTHORIZED error with SESSION_REQUIRED code
      try {
        await handler(mockCtx);
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.status).toBe("UNAUTHORIZED");
        // Check that error body contains the session required code
        expect(error.body?.code || error.message).toMatch(/SESSION_REQUIRED|logged in/i);
      }
    });
  });

  describe("authentication challenges", () => {
    it("should generate authentication challenge without session (unauthenticated user)", async () => {
      // Remove session to simulate unauthenticated user trying to log in
      mockCtx.context.session = undefined;

      mockCtx.body = {
        type: "authentication",
      };

      // Mock challenge creation
      mockCtx.context.adapter.create.mockResolvedValueOnce({
        id: "generated-challenge-id",
        userId: "auto-discovery",
        challenge: expect.any(String),
        type: "authentication",
      });

      const endpoint = createChallengeEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      // Should NOT throw error even without session
      const result = await handler(mockCtx);

      // Verify challenge was created with "auto-discovery" userId
      expect(mockCtx.context.adapter.create).toHaveBeenCalledWith({
        model: "passkeyChallenge",
        data: expect.objectContaining({
          userId: "auto-discovery",
          type: "authentication",
        }),
        forceAllowId: true,
      });

      expect(result).toEqual({
        challenge: expect.any(String),
      });
    });

    it("should generate authentication challenge with auto-discovery when no userId provided", async () => {
      mockCtx.body = {
        type: "authentication",
      };

      // Mock challenge creation
      mockCtx.context.adapter.create.mockResolvedValueOnce({
        id: "generated-challenge-id",
        userId: "auto-discovery",
        challenge: expect.any(String),
        type: "authentication",
      });

      const endpoint = createChallengeEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      const result = await handler(mockCtx);

      // Verify challenge was created with "auto-discovery" userId
      expect(mockCtx.context.adapter.create).toHaveBeenCalledWith({
        model: "passkeyChallenge",
        data: expect.objectContaining({
          userId: "auto-discovery", // Should use auto-discovery, not anonymous
          type: "authentication",
        }),
        forceAllowId: true,
      });

      expect(result).toEqual({
        challenge: expect.any(String),
      });
    });

    it("should generate authentication challenge with provided userId", async () => {
      mockCtx.body = {
        type: "authentication",
        userId: "specific-user-123",
      };

      const endpoint = createChallengeEndpoint(options);
      const handler = (endpoint as any).handler as EndpointHandler;

      await handler(mockCtx);

      // Verify challenge was created with provided userId
      expect(mockCtx.context.adapter.create).toHaveBeenCalledWith({
        model: "passkeyChallenge",
        data: expect.objectContaining({
          userId: "specific-user-123",
          type: "authentication",
        }),
        forceAllowId: true,
      });
    });
  });
});
