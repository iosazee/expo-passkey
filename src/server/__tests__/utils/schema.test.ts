import {
  authenticatePasskeySchema,
  listPasskeysParamsSchema,
  listPasskeysQuerySchema,
  registerPasskeySchema,
  revokePasskeySchema,
} from "../../utils";

describe("Schema definitions", () => {
  describe("registerPasskeySchema", () => {
    it("should validate correct data", () => {
      const validData = {
        userId: "user-123",
        credential: {
          id: "credential-123",
          rawId: "raw-credential-123",
          response: {
            clientDataJSON: "json-data",
            attestationObject: "attestation-object",
            transports: ["internal"],
          },
          type: "public-key",
          authenticatorAttachment: "platform",
        },
        platform: "ios",
        metadata: {
          deviceName: "iPhone 14",
          deviceModel: "iPhone14,3",
          appVersion: "1.0.0",
          manufacturer: "Apple",
          biometricType: "Face ID",
        },
      };

      const result = registerPasskeySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should allow minimal data", () => {
      const minimalData = {
        userId: "user-123",
        credential: {
          id: "credential-123",
          rawId: "raw-credential-123",
          response: {
            clientDataJSON: "json-data",
            attestationObject: "attestation-object",
          },
          type: "public-key",
        },
        platform: "ios",
        // No metadata
      };

      const result = registerPasskeySchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid data", () => {
      // Missing required fields
      const invalidData1 = {
        userId: "user-123",
        platform: "ios",
      };

      const result1 = registerPasskeySchema.safeParse(invalidData1);
      expect(result1.success).toBe(false);

      // Invalid metadata type
      const invalidData2 = {
        userId: "user-123",
        credential: {
          id: "credential-123",
          rawId: "raw-credential-123",
          response: {
            clientDataJSON: "json-data",
            attestationObject: "attestation-object",
          },
          type: "public-key",
        },
        platform: "ios",
        metadata: "not-an-object", // Should be an object
      };

      const result2 = registerPasskeySchema.safeParse(invalidData2);
      expect(result2.success).toBe(false);
    });
  });

  describe("authenticatePasskeySchema", () => {
    it("should validate correct data", () => {
      const validData = {
        credential: {
          id: "credential-123",
          rawId: "raw-credential-123",
          response: {
            clientDataJSON: "json-data",
            authenticatorData: "authenticator-data",
            signature: "signature",
            userHandle: "user-123",
          },
          type: "public-key",
        },
        metadata: {
          lastLocation: "mobile-app",
          appVersion: "1.0.0",
          deviceModel: "iPhone14,3",
          manufacturer: "Apple",
          biometricType: "Face ID",
        },
      };

      const result = authenticatePasskeySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should allow minimal data", () => {
      const minimalData = {
        credential: {
          id: "credential-123",
          rawId: "raw-credential-123",
          response: {
            clientDataJSON: "json-data",
            authenticatorData: "authenticator-data",
            signature: "signature",
          },
          type: "public-key",
        },
      };

      const result = authenticatePasskeySchema.safeParse(minimalData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid data", () => {
      // Missing credential
      const invalidData = {
        metadata: {
          lastLocation: "mobile-app",
        },
      };

      const result = authenticatePasskeySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("revokePasskeySchema", () => {
    it("should validate correct data", () => {
      const validData = {
        userId: "user-123",
        credentialId: "credential-123",
        reason: "lost_device",
      };

      const result = revokePasskeySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should allow omitting reason", () => {
      const dataWithoutReason = {
        userId: "user-123",
        credentialId: "credential-123",
      };

      const result = revokePasskeySchema.safeParse(dataWithoutReason);
      expect(result.success).toBe(true);
    });

    it("should reject missing required fields", () => {
      // Missing userId
      const invalidData1 = {
        credentialId: "credential-123",
      };

      const result1 = revokePasskeySchema.safeParse(invalidData1);
      expect(result1.success).toBe(false);

      // Missing credentialId
      const invalidData2 = {
        userId: "user-123",
      };

      const result2 = revokePasskeySchema.safeParse(invalidData2);
      expect(result2.success).toBe(false);
    });
  });

  describe("listPasskeysParamsSchema", () => {
    it("should validate correct params", () => {
      const validParams = {
        userId: "user-123",
      };

      const result = listPasskeysParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should reject invalid params", () => {
      const invalidParams = {
        userId: 123, // Should be string
      };

      const result = listPasskeysParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe("listPasskeysQuerySchema", () => {
    it("should validate correct query params", () => {
      const validQuery = {
        limit: "10",
        offset: "20",
      };

      const result = listPasskeysQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
    });

    it("should allow empty query params", () => {
      const emptyQuery = {};

      const result = listPasskeysQuerySchema.safeParse(emptyQuery);
      expect(result.success).toBe(true);
    });

    it("should allow partial query params", () => {
      const partialQuery = {
        limit: "10",
      };

      const result = listPasskeysQuerySchema.safeParse(partialQuery);
      expect(result.success).toBe(true);
    });
  });
});
