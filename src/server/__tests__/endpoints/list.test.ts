import { APIError } from "better-call";

import { createListEndpoint } from "../../../server/endpoints/list";

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

type EndpointHandler = (ctx: any) => Promise<any>;

describe("listPasskeys endpoint", () => {
  // Setup options for the endpoint
  const options = {
    logger: mockLogger,
  };

  // Mock passkeys for database responses
  const mockPasskeys = [
    {
      id: "passkey-1",
      userId: "user-123",
      deviceId: "device-1",
      platform: "ios",
      status: "active",
      lastUsed: "2023-02-01T00:00:00Z",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-02-01T00:00:00Z",
      metadata: '{"deviceName":"iPhone 14"}',
    },
    {
      id: "passkey-2",
      userId: "user-123",
      deviceId: "device-2",
      platform: "android",
      status: "active",
      lastUsed: "2023-01-15T00:00:00Z",
      createdAt: "2023-01-10T00:00:00Z",
      updatedAt: "2023-01-15T00:00:00Z",
      metadata: '{"deviceName":"Pixel 7"}',
    },
  ];

  // Mock request context
  const mockCtx = {
    params: {
      userId: "user-123",
    },
    query: {
      limit: "10",
      offset: "0",
    },
    context: {
      adapter: {
        findMany: jest.fn(),
      },
      session: {
        user: {
          id: "user-123", // Match the userId in params for authorization
        },
      },
    },
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should list passkeys for the user successfully", async () => {
    // Mock database response
    mockCtx.context.adapter.findMany.mockResolvedValueOnce(mockPasskeys);

    // Create endpoint and get handler using type assertion
    const endpoint = createListEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call the handler
    await handler(mockCtx as any);

    // Verify database query
    expect(mockCtx.context.adapter.findMany).toHaveBeenCalledWith({
      model: "mobilePasskey",
      where: [
        { field: "userId", operator: "eq", value: "user-123" },
        { field: "status", operator: "eq", value: "active" },
      ],
      sortBy: { field: "lastUsed", direction: "desc" },
      limit: 11, // limit + 1 for pagination
      offset: 0,
    });

    // Verify response
    expect(mockCtx.json).toHaveBeenCalledWith({
      passkeys: expect.arrayContaining([
        expect.objectContaining({
          id: "passkey-1",
          metadata: { deviceName: "iPhone 14" },
        }),
        expect.objectContaining({
          id: "passkey-2",
          metadata: { deviceName: "Pixel 7" },
        }),
      ]),
      nextOffset: undefined, // No pagination for just 2 results with limit 10
    });

    // Verify debug logging
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Passkey list request received:",
      expect.any(Object),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Returning passkeys:",
      expect.any(Object),
    );
  });

  it("should handle pagination correctly", async () => {
    // Create more mock passkeys than the limit
    const extraPasskeys = Array(11)
      .fill(0)
      .map((_, i) => ({
        id: `passkey-${i + 1}`,
        userId: "user-123",
        deviceId: `device-${i + 1}`,
        platform: i % 2 === 0 ? "ios" : "android",
        status: "active",
        lastUsed: `2023-02-0${Math.min(i + 1, 9)}T00:00:00Z`,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: `2023-02-0${Math.min(i + 1, 9)}T00:00:00Z`,
        metadata: `{"deviceName":"Device ${i + 1}"}`,
      }));

    // Mock database response with more passkeys than the limit
    mockCtx.context.adapter.findMany.mockResolvedValueOnce(extraPasskeys);

    // Create endpoint and get handler using type assertion
    const endpoint = createListEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;
    // Call the handler
    await handler(mockCtx as any);

    // Verify database query
    expect(mockCtx.context.adapter.findMany).toHaveBeenCalledWith({
      model: "mobilePasskey",
      where: [
        { field: "userId", operator: "eq", value: "user-123" },
        { field: "status", operator: "eq", value: "active" },
      ],
      sortBy: { field: "lastUsed", direction: "desc" },
      limit: 11, // limit + 1 for pagination check
      offset: 0,
    });

    // Verify response includes nextOffset for pagination
    const responseArg = mockCtx.json.mock.calls[0][0];
    expect(responseArg.nextOffset).toBe(10);

    // Verify only 10 passkeys are returned (not all 11)
    expect(responseArg.passkeys.length).toBe(10);
  });

  it("should reject if the requesting user does not match the userId", async () => {
    // Change the session user to be different from the requested userId
    const modifiedCtx = {
      ...mockCtx,
      context: {
        ...mockCtx.context,
        session: {
          user: {
            id: "different-user", // Different from 'user-123' in params
          },
        },
      },
    };

    // Create endpoint and get handler using type assertion
    const endpoint = createListEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(modifiedCtx as any)).rejects.toThrow(APIError);

    // Verify no database query was made
    expect(mockCtx.context.adapter.findMany).not.toHaveBeenCalled();

    // Verify warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Unauthorized attempt to list passkeys",
      expect.objectContaining({
        requestedUserId: "user-123",
        sessionUserId: "different-user",
      }),
    );
  });

  it("should return an empty array when no passkeys exist", async () => {
    // Mock empty database response
    mockCtx.context.adapter.findMany.mockResolvedValueOnce([]);

    // Create endpoint and get handler using type assertion
    const endpoint = createListEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;
    // Call the handler
    await handler(mockCtx as any);

    // Verify response with empty array
    expect(mockCtx.json).toHaveBeenCalledWith({
      passkeys: [],
      nextOffset: undefined,
    });
  });

  it("should handle database errors gracefully", async () => {
    // Mock database error
    mockCtx.context.adapter.findMany.mockRejectedValueOnce(
      new Error("Database query failed"),
    );

    // Create endpoint and get handler using type assertion
    const endpoint = createListEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx as any)).rejects.toThrow(APIError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error listing passkeys:",
      expect.any(Error),
    );
  });
});
