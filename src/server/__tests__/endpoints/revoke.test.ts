import { APIError } from "better-call";

import { createRevokeEndpoint } from "../../../server/endpoints/revoke";

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

type EndpointHandler = (ctx: any) => Promise<any>;

describe("revokePasskey endpoint", () => {
  // Setup options for the endpoint
  const options = {
    logger: mockLogger,
  };

  // Mock request context
  const mockCtx = {
    body: {
      userId: "user-123",
      credentialId: "device-123",
      reason: "lost_device",
    },
    context: {
      adapter: {
        findOne: jest.fn(),
        update: jest.fn(),
      },
    },
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should revoke a passkey successfully", async () => {
    // Mock credential exists
    mockCtx.context.adapter.findOne.mockResolvedValueOnce({
      id: "passkey-123",
      userId: "user-123",
      deviceId: "device-123",
      platform: "ios",
      status: "active",
    });

    // Create endpoint and get handler using type assertion
    const endpoint = createRevokeEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call the handler
    await handler(mockCtx as any);

    // Verify credential lookup
    expect(mockCtx.context.adapter.findOne).toHaveBeenCalledWith({
      model: "mobilePasskey",
      where: [
        { field: "credentialId", operator: "eq", value: "device-123" },
        { field: "userId", operator: "eq", value: "user-123" },
        { field: "status", operator: "eq", value: "active" },
      ],
    });

    // Verify update was performed
    expect(mockCtx.context.adapter.update).toHaveBeenCalledWith({
      model: "mobilePasskey",
      where: [{ field: "id", operator: "eq", value: "passkey-123" }],
      update: expect.objectContaining({
        status: "revoked",
        revokedReason: "lost_device",
      }),
    });

    // Verify response
    expect(mockCtx.json).toHaveBeenCalledWith({ success: true });

    // Verify logging
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Passkey revoked successfully",
      expect.any(Object),
    );
  });

  it("should use default reason if none provided", async () => {
    // Mock credential exists
    mockCtx.context.adapter.findOne.mockResolvedValueOnce({
      id: "passkey-123",
      userId: "user-123",
      deviceId: "device-123",
      platform: "ios",
      status: "active",
    });

    // Create a modified context without reason
    const modifiedCtx = {
      ...mockCtx,
      body: {
        userId: "user-123",
        deviceId: "device-123",
        // No reason provided
      },
    };

    // Create endpoint and get handler using type assertion
    const endpoint = createRevokeEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call the handler
    await handler(modifiedCtx as any);

    // Verify update was performed with default reason
    expect(mockCtx.context.adapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          revokedReason: "user_initiated", // Default reason
        }),
      }),
    );
  });

  it("should reject if the passkey is not found", async () => {
    // Mock credential not found
    mockCtx.context.adapter.findOne.mockResolvedValueOnce(null);

    // Create endpoint and get handler using type assertion
    const endpoint = createRevokeEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx as any)).rejects.toThrow(APIError);

    // Verify lookup was attempted
    expect(mockCtx.context.adapter.findOne).toHaveBeenCalledWith({
      model: "mobilePasskey",
      where: [
        { field: "credentialId", operator: "eq", value: "device-123" },
        { field: "userId", operator: "eq", value: "user-123" },
        { field: "status", operator: "eq", value: "active" },
      ],
    });

    // Verify no update was performed
    expect(mockCtx.context.adapter.update).not.toHaveBeenCalled();

    // Verify warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Revoke failed: Passkey not found",
      expect.any(Object),
    );
  });

  it("should handle database update errors gracefully", async () => {
    // Mock credential exists
    mockCtx.context.adapter.findOne.mockResolvedValueOnce({
      id: "passkey-123",
      userId: "user-123",
      deviceId: "device-123",
      platform: "ios",
      status: "active",
    });

    // Mock update error
    mockCtx.context.adapter.update.mockRejectedValueOnce(
      new Error("Database update failed"),
    );

    // Create endpoint and get handler using type assertion
    const endpoint = createRevokeEndpoint(options);
    const handler = (endpoint as any).handler as EndpointHandler;

    // Call handler and expect it to throw
    await expect(handler(mockCtx as any)).rejects.toThrow(APIError);

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to revoke passkey",
      expect.any(Error),
    );
  });
});
