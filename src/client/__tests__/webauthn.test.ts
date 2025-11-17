/**
 * @file Tests for WebAuthn utility functions
 * @module expo-passkey/client/utils/webauthn.test
 */

import { createAuthenticationOptions } from "../utils/webauthn";

describe("createAuthenticationOptions", () => {
  const challenge = "test-challenge-12345";
  const rpId = "example.com";

  describe("allowCredentials field", () => {
    it("should omit allowCredentials when options is undefined", () => {
      const result = createAuthenticationOptions(challenge, rpId);

      expect(result).toEqual({
        challenge,
        rpId,
        timeout: 60000,
        userVerification: "required",
      });
      expect(result).not.toHaveProperty("allowCredentials");
    });

    it("should omit allowCredentials when options.allowCredentials is undefined", () => {
      const result = createAuthenticationOptions(challenge, rpId, {
        timeout: 30000,
      });

      expect(result).toEqual({
        challenge,
        rpId,
        timeout: 30000,
        userVerification: "required",
      });
      expect(result).not.toHaveProperty("allowCredentials");
    });

    it("should omit allowCredentials when options.allowCredentials is empty array", () => {
      const result = createAuthenticationOptions(challenge, rpId, {
        allowCredentials: [],
      });

      expect(result).toEqual({
        challenge,
        rpId,
        timeout: 60000,
        userVerification: "required",
      });
      expect(result).not.toHaveProperty("allowCredentials");
    });

    it("should include allowCredentials when it has items", () => {
      const credentials = [
        { id: "credential-id-1", type: "public-key" as const },
        { id: "credential-id-2", type: "public-key" as const },
      ];

      const result = createAuthenticationOptions(challenge, rpId, {
        allowCredentials: credentials,
      });

      expect(result).toEqual({
        challenge,
        rpId,
        timeout: 60000,
        userVerification: "required",
        allowCredentials: [
          {
            type: "public-key",
            id: "credential-id-1",
            transports: ["internal"],
          },
          {
            type: "public-key",
            id: "credential-id-2",
            transports: ["internal"],
          },
        ],
      });
    });
  });

  describe("other options", () => {
    it("should use custom timeout when provided", () => {
      const result = createAuthenticationOptions(challenge, rpId, {
        timeout: 30000,
      });

      expect(result.timeout).toBe(30000);
    });

    it("should use custom userVerification when provided", () => {
      const result = createAuthenticationOptions(challenge, rpId, {
        userVerification: "preferred",
      });

      expect(result.userVerification).toBe("preferred");
    });

    it("should use default timeout of 60000 when not provided", () => {
      const result = createAuthenticationOptions(challenge, rpId);

      expect(result.timeout).toBe(60000);
    });

    it("should use default userVerification of 'required' when not provided", () => {
      const result = createAuthenticationOptions(challenge, rpId);

      expect(result.userVerification).toBe("required");
    });
  });
});
