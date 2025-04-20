import * as endpointExports from "../../endpoints";
import { createAuthenticateEndpoint as authenticate } from "../../endpoints/authenticate";
import { createListEndpoint as list } from "../../endpoints/list";
import { createRegisterEndpoint as register } from "../../endpoints/register";
import { createRevokeEndpoint as revoke } from "../../endpoints/revoke";

describe("server/endpoints module exports", () => {
  it("should export createRegisterEndpoint from register", () => {
    expect(endpointExports.createRegisterEndpoint).toBe(register);
  });

  it("should export createAuthenticateEndpoint from authenticate", () => {
    expect(endpointExports.createAuthenticateEndpoint).toBe(authenticate);
  });

  it("should export createListEndpoint from list", () => {
    expect(endpointExports.createListEndpoint).toBe(list);
  });

  it("should export createRevokeEndpoint from revoke", () => {
    expect(endpointExports.createRevokeEndpoint).toBe(revoke);
  });

  it("should export the five endpoint creators", () => {
    expect(Object.keys(endpointExports).sort()).toEqual(
      [
        "createRegisterEndpoint",
        "createAuthenticateEndpoint",
        "createListEndpoint",
        "createRevokeEndpoint",
        "createChallengeEndpoint",
      ].sort(),
    );
  });
});
