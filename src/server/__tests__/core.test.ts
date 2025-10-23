import type { AuthContext, BetterAuthPlugin } from "better-auth/types";
import { ERROR_CODES, type AuthPasskey } from "../../types";
import { expoPasskey } from "../core";
import { createLogger, createRateLimits, setupCleanupJob } from "../utils";

// Mock dependencies
jest.mock("../endpoints", () => ({
  createChallengeEndpoint: jest.fn().mockReturnValue({
    path: "/expo-passkey/challenge",
    options: {},
    handler: jest.fn(),
  }),
  createRegisterEndpoint: jest.fn().mockReturnValue({
    path: "/expo-passkey/register",
    options: {},
    handler: jest.fn(),
  }),
  createAuthenticateEndpoint: jest.fn().mockReturnValue({
    path: "/expo-passkey/authenticate",
    options: {},
    handler: jest.fn(),
  }),
  createListEndpoint: jest.fn().mockReturnValue({
    path: "/expo-passkey/list/:userId",
    options: {},
    handler: jest.fn(),
  }),
  createRevokeEndpoint: jest.fn().mockReturnValue({
    path: "/expo-passkey/revoke",
    options: {},
    handler: jest.fn(),
  }),
}));

// Mock utils
jest.mock("../utils", () => ({
  createLogger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  createRateLimits: jest.fn().mockReturnValue([
    {
      pathMatcher: (path: string) => path === "/expo-passkey/register",
      window: 300,
      max: 3,
    },
  ]),
  setupCleanupJob: jest.fn(),
}));

describe("expoPasskey server plugin", () => {
  // Mock context for plugin initialization
  const mockCtx = {
    adapter: {
      findOne: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      id: "mock-adapter",
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    internalAdapter: {
      createSession: jest.fn(),
      findSession: jest.fn(),
      createOAuthUser: jest.fn(),
      createUser: jest.fn(),
      createAccount: jest.fn(),
      linkAccount: jest.fn(),
      unlinkAccount: jest.fn(),
      listSessions: jest.fn(),
      getUser: jest.fn(),
      getSession: jest.fn(),
      getAccount: jest.fn(),
      updateUser: jest.fn(),
      updateSession: jest.fn(),
      updateAccount: jest.fn(),
      deleteUser: jest.fn(),
      deleteSession: jest.fn(),
      deleteAccount: jest.fn(),
    },
    generateId: jest.fn(() => "generated-id"),
    trustedOrigins: ["https://example.com"],
    options: {
      session: {
        cookieCache: {
          enabled: true,
        },
      },
    },
    context: {},
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn(),
    },
  } as unknown as AuthContext;

  // Default plugin options
  const validOptions = {
    rpName: "Test App",
    rpId: "example.com",
    origin: "https://example.com",
    logger: {
      enabled: false,
    },
    rateLimit: {
      registerWindow: 300,
      registerMax: 3,
    },
    cleanup: {
      inactiveDays: 30,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a valid plugin instance with required options", () => {
    const plugin = expoPasskey(validOptions) as BetterAuthPlugin & {
      schema: NonNullable<BetterAuthPlugin["schema"]>;
      endpoints: NonNullable<BetterAuthPlugin["endpoints"]>;
    };

    expect(plugin).toBeDefined();
    expect(plugin.id).toBe("expo-passkey");
    expect(plugin.schema).toBeDefined();
    expect(plugin.schema.authPasskey).toBeDefined();
    expect(plugin.endpoints).toBeDefined();
    expect(plugin.endpoints.passkeyChallenges).toBeDefined();
    expect(plugin.endpoints.registerPasskey).toBeDefined();
    expect(plugin.endpoints.authenticatePasskey).toBeDefined();
    expect(plugin.endpoints.listPasskeys).toBeDefined();
    expect(plugin.endpoints.revokePasskey).toBeDefined();
    expect(plugin.$ERROR_CODES).toBe(ERROR_CODES.SERVER);
  });

  it("should create a plugin with custom schema model names", () => {
    const customOptions = {
      ...validOptions,
      schema: {
        authPasskey: {
          modelName: "customPasskeyTable",
        },
        passkeyChallenge: {
          modelName: "customChallengeTable",
        },
      },
    };

    const plugin = expoPasskey(customOptions) as BetterAuthPlugin & {
      schema: NonNullable<BetterAuthPlugin["schema"]>;
    };

    expect(plugin.schema.customPasskeyTable).toBeDefined();
    expect(plugin.schema.customChallengeTable).toBeDefined();
    expect(plugin.schema.customPasskeyTable.modelName).toBe(
      "customPasskeyTable",
    );
    expect(plugin.schema.customChallengeTable.modelName).toBe(
      "customChallengeTable",
    );
  });

  it("should throw error if required options are missing", () => {
    // @ts-expect-error - intentionally passing invalid options
    expect(() => expoPasskey({})).toThrow(
      "rpName and rpId are required options",
    );
    // @ts-expect-error - intentionally passing invalid options
    expect(() => expoPasskey({ rpName: "Test App" })).toThrow(
      "rpName and rpId are required options",
    );
    // @ts-expect-error - intentionally passing invalid options
    expect(() => expoPasskey({ rpId: "example.com" })).toThrow(
      "rpName and rpId are required options",
    );
  });

  it("should create logger with correct options", () => {
    expoPasskey(validOptions);
    expect(createLogger).toHaveBeenCalledWith(validOptions.logger);
  });

  it("should create rate limits with correct options", () => {
    expoPasskey(validOptions);
    expect(createRateLimits).toHaveBeenCalledWith(validOptions.rateLimit);
  });

  it("should initialize cleanup job during init", () => {
    const plugin = expoPasskey(validOptions);

    // Call init if it exists
    if (plugin.init) {
      plugin.init(mockCtx);
    }

    expect(setupCleanupJob).toHaveBeenCalledWith(
      mockCtx,
      validOptions.cleanup,
      expect.anything(), // logger
      {
        authPasskeyModel: "authPasskey",
        passkeyChallengeModel: "passkeyChallenge",
      }, // default schemaConfig
    );
  });

  it("should initialize cleanup job with custom schema config", () => {
    const customOptions = {
      ...validOptions,
      schema: {
        authPasskey: {
          modelName: "customPasskeyTable",
        },
        passkeyChallenge: {
          modelName: "customChallengeTable",
        },
      },
    };

    const plugin = expoPasskey(customOptions);

    // Call init if it exists
    if (plugin.init) {
      plugin.init(mockCtx);
    }

    // Expect the call with custom schema config
    expect(setupCleanupJob).toHaveBeenCalledWith(
      mockCtx,
      customOptions.cleanup,
      expect.anything(), // logger
      {
        authPasskeyModel: "customPasskeyTable",
        passkeyChallengeModel: "customChallengeTable",
      }, // custom schemaConfig
    );
  });

  it("should define proper authPasskey schema", () => {
    const plugin = expoPasskey(validOptions) as BetterAuthPlugin & {
      schema: NonNullable<BetterAuthPlugin["schema"]>;
    };
    const schema = plugin.schema.authPasskey;

    // Check that model name is correct
    expect(schema.modelName).toBe("authPasskey");

    // Get field keys from AuthPasskey type, excluding the 'id' which is auto-generated
    type AuthPasskeySchemaFields = Omit<AuthPasskey, "id">;
    const expectedFields: Array<keyof AuthPasskeySchemaFields | string> = [
      "userId",
      "credentialId",
      "publicKey",
      "counter",
      "platform",
      "lastUsed",
      "status",
      "createdAt",
      "updatedAt",
      "revokedAt",
      "revokedReason",
      "metadata",
      "aaguid",
    ];

    // Verify each field exists in the schema
    expectedFields.forEach((field) => {
      expect(schema.fields).toHaveProperty(String(field));
    });

    // Check critical constraints that are important for functionality
    expect(schema.fields.userId.references).toEqual({
      model: "user",
      field: "id",
      onDelete: "cascade",
    });
    expect(schema.fields.credentialId.unique).toBe(true);
    expect(schema.fields.status.defaultValue).toBe("active");
  });

  it("should define correct middleware for route protection", () => {
    const plugin = expoPasskey(validOptions) as BetterAuthPlugin & {
      middlewares: NonNullable<BetterAuthPlugin["middlewares"]>;
    };

    expect(plugin.middlewares).toBeDefined();
    expect(plugin.middlewares).toHaveLength(2);

    // First middleware: conditional session check for challenge endpoint
    expect(plugin.middlewares?.[0].path).toBe("/expo-passkey/challenge");
    expect(plugin.middlewares?.[0].middleware).toBeDefined();

    // Second middleware: origin validation for all endpoints
    expect(plugin.middlewares?.[1].path).toBe("/expo-passkey/**");
    expect(plugin.middlewares?.[1].middleware).toBeDefined();
  });
});
