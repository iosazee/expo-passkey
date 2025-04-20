/**
 * @file Tests for the mobilePasskey schema
 * @description Tests specifically for the Mobile Passkey DB model
 */

import { mobilePasskeySchema } from "../../../types";

describe("MobilePasskey Schema Tests", () => {
  describe("mobilePasskeySchema validation", () => {
    // Test the default value for status
    it("should apply default value 'active' for status when missing", () => {
      const passkey = {
        id: "passkey-123",
        userId: "user-123",
        credentialId: "credential-123",
        publicKey: "public-key-data",
        counter: 0,
        platform: "ios",
        lastUsed: "2023-01-01T00:00:00Z",
        // No status
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = mobilePasskeySchema.safeParse(passkey);
      expect(result.success).toBe(true);

      if (result.success) {
        // Verify default status is 'active'
        expect(result.data.status).toBe("active");
      }
    });

    // Verify required fields
    it("should reject when required fields are missing", () => {
      // Missing userId
      const missingUserId = {
        id: "passkey-123",
        // No userId
        credentialId: "credential-123",
        publicKey: "public-key-data",
        counter: 0,
        platform: "ios",
        lastUsed: "2023-01-01T00:00:00Z",
      };

      const result1 = mobilePasskeySchema.safeParse(missingUserId);
      expect(result1.success).toBe(false);

      // Missing credentialId
      const missingCredentialId = {
        id: "passkey-123",
        userId: "user-123",
        // No credentialId
        publicKey: "public-key-data",
        counter: 0,
        platform: "ios",
        lastUsed: "2023-01-01T00:00:00Z",
      };

      const result2 = mobilePasskeySchema.safeParse(missingCredentialId);
      expect(result2.success).toBe(false);

      // Missing publicKey
      const missingPublicKey = {
        id: "passkey-123",
        userId: "user-123",
        credentialId: "credential-123",
        // No publicKey
        counter: 0,
        platform: "ios",
        lastUsed: "2023-01-01T00:00:00Z",
      };

      const result3 = mobilePasskeySchema.safeParse(missingPublicKey);
      expect(result3.success).toBe(false);
    });
  });
});
