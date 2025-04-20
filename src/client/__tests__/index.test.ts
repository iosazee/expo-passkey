// Mock the native module before importing
jest.mock("../native-module", () => ({
  getNativeModule: jest.fn(),
  isNativePasskeySupported: jest.fn().mockResolvedValue(true),
  createNativePasskey: jest.fn().mockResolvedValue({
    id: "test-credential-id",
    rawId: "test-raw-id",
    type: "public-key",
    response: {
      clientDataJSON: "test-client-data",
      attestationObject: "test-attestation",
      publicKey: "test-public-key",
      transports: ["internal"],
    },
    authenticatorAttachment: "platform",
  }),
  authenticateWithNativePasskey: jest.fn().mockResolvedValue({
    id: "test-credential-id",
    rawId: "test-raw-id",
    type: "public-key",
    response: {
      clientDataJSON: "test-client-data",
      authenticatorData: "test-auth-data",
      signature: "test-signature",
      userHandle: "test-user-handle",
    },
    authenticatorAttachment: "platform",
  }),
}));

// Now import the modules
import * as coreExports from "../core";
import * as indexExports from "../index";

describe("src/client/index.ts exports", () => {
  it("should re-export everything from ~/client/core", () => {
    // Check that all exports from core exist in index
    expect(indexExports).toEqual(coreExports);
  });
});
