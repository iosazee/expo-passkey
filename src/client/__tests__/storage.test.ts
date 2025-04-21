/**
 * @file Tests for storage utilities
 * @module expo-passkey/utils/storage
 */

import type { ExpoPasskeyClientOptions } from "../../types/client";
import { getStorageKeys } from "../utils/storage";

describe("Storage utilities", () => {
  describe("getStorageKeys", () => {
    it("should use default prefix when no options are provided", () => {
      const keys = getStorageKeys();

      expect(keys).toEqual({
        DEVICE_ID: "_better-auth.device_id",
        STATE: "_better-auth.passkey_state",
        USER_ID: "_better-auth.user_id",
        CREDENTIAL_IDS: "_better-auth.credential_ids",
      });
    });

    it("should use default prefix when empty options are provided", () => {
      const keys = getStorageKeys({});

      expect(keys).toEqual({
        DEVICE_ID: "_better-auth.device_id",
        STATE: "_better-auth.passkey_state",
        USER_ID: "_better-auth.user_id",
        CREDENTIAL_IDS: "_better-auth.credential_ids",
      });
    });

    it("should use custom prefix when provided", () => {
      const options: ExpoPasskeyClientOptions = {
        storagePrefix: "myapp",
      };

      const keys = getStorageKeys(options);

      expect(keys).toEqual({
        DEVICE_ID: "myapp.device_id",
        STATE: "myapp.passkey_state",
        USER_ID: "myapp.user_id",
        CREDENTIAL_IDS: "myapp.credential_ids",
      });
    });

    it("should use default prefix for empty string prefix", () => {
      const options: ExpoPasskeyClientOptions = {
        storagePrefix: "",
      };

      const keys = getStorageKeys(options);

      // Empty string is falsy, so default prefix is used
      expect(keys).toEqual({
        DEVICE_ID: "_better-auth.device_id",
        STATE: "_better-auth.passkey_state",
        USER_ID: "_better-auth.user_id",
        CREDENTIAL_IDS: "_better-auth.credential_ids",
      });
    });

    it("should handle numeric prefix", () => {
      const options: ExpoPasskeyClientOptions = {
        storagePrefix: "123",
      };

      const keys = getStorageKeys(options);

      expect(keys).toEqual({
        DEVICE_ID: "123.device_id",
        STATE: "123.passkey_state",
        USER_ID: "123.user_id",
        CREDENTIAL_IDS: "123.credential_ids",
      });
    });

    it("should handle special characters in prefix", () => {
      const options: ExpoPasskeyClientOptions = {
        storagePrefix: "app@special_chars",
      };

      const keys = getStorageKeys(options);

      expect(keys).toEqual({
        DEVICE_ID: "app@special_chars.device_id",
        STATE: "app@special_chars.passkey_state",
        USER_ID: "app@special_chars.user_id",
        CREDENTIAL_IDS: "app@special_chars.credential_ids",
      });
    });

    it("should handle undefined prefix by using default", () => {
      const options: ExpoPasskeyClientOptions = {
        storagePrefix: undefined,
      };

      const keys = getStorageKeys(options);

      expect(keys).toEqual({
        DEVICE_ID: "_better-auth.device_id",
        STATE: "_better-auth.passkey_state",
        USER_ID: "_better-auth.user_id",
        CREDENTIAL_IDS: "_better-auth.credential_ids",
      });
    });
  });
});
