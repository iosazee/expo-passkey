import * as cleanupExports from "../../utils/cleanup";
import * as utilsExports from "../../utils/index";
import * as loggerExports from "../../utils/logger";
import * as rateLimitExports from "../../utils/rate-limit";
import * as schemaExports from "../../utils/schema";
import * as sessionExports from "../../utils/session";

describe("server/utils module exports", () => {
  it("should export everything from cleanup", () => {
    Object.keys(cleanupExports).forEach((key) => {
      expect(utilsExports[key as keyof typeof utilsExports]).toBe(
        cleanupExports[key as keyof typeof cleanupExports],
      );
    });
  });

  it("should export everything from logger", () => {
    Object.keys(loggerExports).forEach((key) => {
      expect(utilsExports[key as keyof typeof utilsExports]).toBe(
        loggerExports[key as keyof typeof loggerExports],
      );
    });
  });

  it("should export everything from rate-limit", () => {
    Object.keys(rateLimitExports).forEach((key) => {
      expect(utilsExports[key as keyof typeof utilsExports]).toBe(
        rateLimitExports[key as keyof typeof rateLimitExports],
      );
    });
  });

  it("should export everything from schema", () => {
    Object.keys(schemaExports).forEach((key) => {
      expect(utilsExports[key as keyof typeof utilsExports]).toBe(
        schemaExports[key as keyof typeof schemaExports],
      );
    });
  });

  it("should export everything from session", () => {
    Object.keys(sessionExports).forEach((key) => {
      expect(utilsExports[key as keyof typeof utilsExports]).toBe(
        sessionExports[key as keyof typeof sessionExports],
      );
    });
  });

  it("should only export members from cleanup, logger, rate-limit, schema, and session", () => {
    const expectedExports = [
      ...Object.keys(cleanupExports),
      ...Object.keys(loggerExports),
      ...Object.keys(rateLimitExports),
      ...Object.keys(schemaExports),
      ...Object.keys(sessionExports),
    ];

    const actualExports = Object.keys(utilsExports);

    expect(actualExports.sort()).toEqual(expectedExports.sort());
  });
});
