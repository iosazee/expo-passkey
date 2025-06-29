/**
 * @file Unit tests for the cleanup utility
 */

import { setupCleanupJob, type CleanupOptions } from "../../utils/cleanup";

import type { Logger } from "../../utils/logger";

// Set up for each individual test
const setupTest = (options?: CleanupOptions) => {
  // Create fresh mocks for each test
  const mockUpdateMany = jest.fn().mockResolvedValue(5);
  const mockAdapter = { updateMany: mockUpdateMany };
  const mockContext = { adapter: mockAdapter };

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // Spy on setInterval
  const setIntervalSpy = jest.spyOn(global, "setInterval");

  // Call the function with the specified options
  const result = setupCleanupJob(
    mockContext as any,
    options || {},
    mockLogger as Logger,
  );

  return {
    mockContext,
    mockAdapter,
    mockUpdateMany,
    mockLogger,
    setIntervalSpy,
    result,
  };
};

describe("Cleanup utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("should setup the cleanup job with default options", () => {
    const { mockUpdateMany, setIntervalSpy, result } = setupTest();

    // Calculate expected cutoff date (30 days ago by default)
    const expectedCutoff = new Date("2023-01-01T00:00:00Z");
    expectedCutoff.setDate(expectedCutoff.getDate() - 30);

    // Verify immediate cleanup was triggered with correct params
    expect(mockUpdateMany).toHaveBeenCalledWith({
      model: "authPasskey",
      where: [
        {
          field: "lastUsed",
          operator: "lt",
          value: expectedCutoff.toISOString(),
        },
        { field: "status", operator: "eq", value: "active" },
      ],
      update: {
        status: "revoked",
        revokedAt: new Date("2023-01-01T00:00:00Z").toISOString(),
        revokedReason: "automatic_inactive",
        updatedAt: new Date("2023-01-01T00:00:00Z").toISOString(),
      },
    });

    // Verify interval was set up
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      24 * 60 * 60 * 1000,
    );

    // Verify function returned the interval handle
    expect(result).toBeDefined();
  });

  test("should respect the inactiveDays option", () => {
    const { mockUpdateMany } = setupTest({ inactiveDays: 60 });

    // Calculate expected cutoff date (60 days ago)
    const expectedCutoff = new Date("2023-01-01T00:00:00Z");
    expectedCutoff.setDate(expectedCutoff.getDate() - 60);

    // Verify cutoff date is correct
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          {
            field: "lastUsed",
            operator: "lt",
            value: expectedCutoff.toISOString(),
          },
        ]),
      }),
    );
  });

  test("should return early if inactiveDays is 0", () => {
    const { mockUpdateMany, setIntervalSpy, result } = setupTest({
      inactiveDays: 0,
    });

    // Verify nothing happened - early return
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test("should return early if inactiveDays is negative", () => {
    const { mockUpdateMany, setIntervalSpy, result } = setupTest({
      inactiveDays: -10,
    });

    // Verify nothing happened - early return
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test("should not run any cleanup when disableInterval is true", () => {
    const { mockUpdateMany, setIntervalSpy, result, mockLogger } = setupTest({
      inactiveDays: 30,
      disableInterval: true,
    });

    // Verify immediate cleanup was NOT triggered
    expect(mockUpdateMany).not.toHaveBeenCalled();

    // Verify interval was NOT set up
    expect(setIntervalSpy).not.toHaveBeenCalled();

    // Verify function returned null instead of interval handle
    expect(result).toBeNull();

    // Verify debug log was called
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Cleanup interval disabled, skipping all cleanup operations",
    );
  });

  test("should log errors if the cleanup job fails", async () => {
    // Setup a test with a failing updateMany
    const mockUpdateMany = jest
      .fn()
      .mockRejectedValue(new Error("Database error"));
    const mockAdapter = { updateMany: mockUpdateMany };
    const mockContext = { adapter: mockAdapter };

    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Call function
    setupCleanupJob(mockContext as any, {}, mockLogger as Logger);

    // Wait for promises to resolve
    await Promise.resolve();

    // Verify error was logged
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Cleanup job failed:",
      expect.any(Error),
    );
  });

  test("should log info about cleaned up passkeys in non-production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // Set environment to development
      process.env.NODE_ENV = "development";

      const { mockLogger } = setupTest();

      // Wait for promises to resolve
      await Promise.resolve();

      // Verify info was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Cleaned up 5 inactive passkeys",
      );
    } finally {
      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test("should not log info about cleaned up passkeys in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      // Set environment to production
      process.env.NODE_ENV = "production";

      const { mockLogger } = setupTest();

      // Wait for promises to resolve
      await Promise.resolve();

      // Verify info was not logged
      expect(mockLogger.info).not.toHaveBeenCalled();
    } finally {
      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
