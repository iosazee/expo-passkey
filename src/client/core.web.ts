/**
 * @file Web-only implementation of the Expo Passkey client
 * @module expo-passkey/client/core.web
 */

import type {
  BetterFetchOption,
  BetterFetchPlugin,
  ErrorContext,
} from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";

import type {
  AuthPasskeySuccessResponse,
  AuthenticatePasskeyResult,
  ChallengeResponse,
  ChallengeResult,
  ExpoPasskeyClientOptions,
  ExpoPasskeyServerPlugin,
  ListPasskeysResult,
  ListPasskeysSuccessResponse,
  PasskeyMetadata,
  PasskeyRegistrationCheckResult,
  RegisterPasskeyResult,
  RegisterPasskeySuccessResponse,
  RevokePasskeyResult,
} from "../types";

import { ERROR_CODES, PasskeyError } from "../types/errors";

// Web-specific imports - safe to import here since this file is web-only
import {
  getWebAuthnBrowser,
  createWebRegistrationOptions,
  createWebAuthenticationOptions,
  isWebAuthnSupportedInBrowser,
  isPlatformAuthenticatorAvailable,
} from "./utils/web";

/**
 * Web-only client implementation
 */
class ExpoPasskeyClient {
  private options: ExpoPasskeyClientOptions;

  constructor(options: ExpoPasskeyClientOptions = {}) {
    this.options = {
      storagePrefix: options.storagePrefix || "_better-auth",
      timeout: options.timeout || 60000,
    };
  }

  public async getDeviceInformation() {
    // Handle cases where navigator might not be available
    const userAgent =
      typeof navigator !== "undefined"
        ? navigator.userAgent
        : "Unknown Browser";
    const platform =
      typeof navigator !== "undefined" ? navigator.platform : "Unknown OS";

    return {
      deviceId: `web-${Date.now()}`,
      platform: "web" as const,
      model: userAgent,
      manufacturer: null,
      osVersion: platform,
      appVersion: "1.0.0",
      biometricSupport: {
        isSupported: isWebAuthnSupportedInBrowser(),
        isEnrolled: true, // Assume true for web
        availableTypes: [],
        authenticationType: "Platform Authenticator",
        error: null,
        platformDetails: {
          platform: "web",
          version: userAgent,
        },
      },
    };
  }

  public getOptions() {
    return this.options;
  }

  public async isWebAuthnSupported() {
    return isWebAuthnSupportedInBrowser();
  }
}

/**
 * Creates web-only Expo Passkey client plugin
 */
export const expoPasskeyClient = (options: ExpoPasskeyClientOptions = {}) => {
  const client = new ExpoPasskeyClient(options);

  return {
    id: "expo-passkey",
    $InferServerPlugin: {} as ExpoPasskeyServerPlugin,

    pathMethods: {
      "/expo-passkey/challenge": "POST",
      "/expo-passkey/register": "POST",
      "/expo-passkey/authenticate": "POST",
      "/expo-passkey/list/:userId": "GET",
      "/expo-passkey/revoke": "POST",
    },

    getActions: ($fetch) => {
      const getChallenge = async (
        data: {
          userId?: string; // Optional - only used for authentication challenges
          type: "registration" | "authentication";
          registrationOptions?: {
            attestation?: "none" | "indirect" | "direct" | "enterprise";
            authenticatorSelection?: {
              authenticatorAttachment?: "platform" | "cross-platform";
              residentKey?: "required" | "preferred" | "discouraged";
              requireResidentKey?: boolean;
              userVerification?: "required" | "preferred" | "discouraged";
            };
            timeout?: number;
          };
        },
        fetchOptions?: BetterFetchOption
      ): Promise<ChallengeResult> => {
        try {
          const { data: challengeData, error: challengeError } =
            await $fetch<ChallengeResponse>("/expo-passkey/challenge", {
              method: "POST",
              body: {
                ...(data.userId && { userId: data.userId }), // Only include if provided
                type: data.type,
                registrationOptions: data.registrationOptions,
              },
              ...fetchOptions,
            });

          if (challengeData) {
            return { data: challengeData, error: null };
          }

          throw challengeError
            ? new Error(
                challengeError.message ||
                  `Failed to get challenge: ${challengeError.statusText}`
              )
            : new Error("Failed to get challenge");
        } catch (error) {
          return {
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      };

      return {
        getChallenge,

        /**
         * Web-only passkey registration
         */
        registerPasskey: async (
          data: {
            userId: string;
            userName: string;
            displayName?: string;
            rpName?: string;
            rpId?: string;
            attestation?: "none" | "indirect" | "direct" | "enterprise";
            authenticatorSelection?: {
              authenticatorAttachment?: "platform" | "cross-platform";
              residentKey?: "required" | "preferred" | "discouraged";
              requireResidentKey?: boolean;
              userVerification?: "required" | "preferred" | "discouraged";
            };
            timeout?: number;
            metadata?: Partial<PasskeyMetadata>;
          },
          fetchOptions?: BetterFetchOption
        ): Promise<RegisterPasskeyResult> => {
          try {
            const isSupported = await client.isWebAuthnSupported();
            if (!isSupported) {
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.NOT_SUPPORTED,
                "WebAuthn is not supported on this browser"
              );
            }

            // Get WebAuthn browser module (statically imported)
            const webAuthn = getWebAuthnBrowser();
            // const deviceInfo = await client.getDeviceInformation();

            // Prepare registration options to send to server
            const registrationOptions = {
              attestation: data.attestation,
              authenticatorSelection: data.authenticatorSelection,
              timeout: data.timeout || client.getOptions().timeout,
            };

            // Get challenge from server
            // Note: userId is no longer sent to server for security - server gets it from session
            const challengeResult = await getChallenge({
              type: "registration",
              registrationOptions,
            });

            if (!challengeResult.data) {
              throw (
                challengeResult.error || new Error("Failed to get challenge")
              );
            }

            // Create registration options for web
            const webAuthnOptions = createWebRegistrationOptions(
              challengeResult.data.challenge,
              data.userId,
              data.userName,
              data.displayName || data.userName,
              data.rpId ||
                (typeof window !== "undefined"
                  ? window.location.hostname
                  : "localhost"),
              data.rpName || "App",
              {
                timeout: data.timeout || client.getOptions().timeout,
                attestation: data.attestation || "none",
                authenticatorSelection: data.authenticatorSelection || {
                  authenticatorAttachment: "platform",
                  userVerification: "preferred",
                  residentKey: "preferred",
                },
              }
            );

            // Start registration with WebAuthn browser
            const credential = await webAuthn.startRegistration({
              optionsJSON: webAuthnOptions,
            });

            // Register with server
            // Note: userId is no longer sent to server for security - server gets it from session
            const { data: registrationData, error: registrationError } =
              await $fetch<RegisterPasskeySuccessResponse>(
                "/expo-passkey/register",
                {
                  method: "POST",
                  body: {
                    credential,
                    platform: "web",
                    metadata: {
                      deviceName:
                        typeof navigator !== "undefined"
                          ? navigator.userAgent
                          : "Unknown Browser",
                      appVersion: "1.0.0",
                      ...data.metadata,
                    },
                  },
                  ...fetchOptions,
                }
              );

            if (registrationData) {
              return { data: registrationData, error: null };
            }

            throw registrationError || new Error("Failed to register passkey");
          } catch (error) {
            return {
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        /**
         * Web-only passkey authentication
         */
        authenticateWithPasskey: async (
          data?: {
            userId?: string;
            rpId?: string;
            timeout?: number;
            userVerification?: "required" | "preferred" | "discouraged";
            metadata?: Partial<PasskeyMetadata>;
          },
          fetchOptions?: BetterFetchOption
        ): Promise<AuthenticatePasskeyResult> => {
          try {
            const isSupported = await client.isWebAuthnSupported();
            if (!isSupported) {
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.NOT_SUPPORTED,
                "WebAuthn is not supported on this browser"
              );
            }

            // Get WebAuthn browser module (statically imported)
            const webAuthn = getWebAuthnBrowser();
            // const deviceInfo = await client.getDeviceInformation();

            // Get challenge
            const challengeUserId = data?.userId || "auto-discovery";
            const challengeResult = await getChallenge({
              userId: challengeUserId,
              type: "authentication",
            });

            if (!challengeResult.data) {
              throw (
                challengeResult.error || new Error("Failed to get challenge")
              );
            }

            // Create authentication options for web
            const authenticationOptions = createWebAuthenticationOptions(
              challengeResult.data.challenge,
              data?.rpId ||
                (typeof window !== "undefined"
                  ? window.location.hostname
                  : "localhost"),
              {
                timeout: data?.timeout || client.getOptions().timeout,
                userVerification: data?.userVerification || "preferred",
              }
            );

            // Start authentication with WebAuthn browser
            const credential = await webAuthn.startAuthentication({
              optionsJSON: authenticationOptions,
            });

            // Authenticate with server
            const { data: authData, error: authError } =
              await $fetch<AuthPasskeySuccessResponse>(
                "/expo-passkey/authenticate",
                {
                  method: "POST",
                  body: {
                    credential,
                    metadata: {
                      lastLocation: "web-app",
                      appVersion: "1.0.0",
                      ...data?.metadata,
                    },
                  },
                  credentials: "include",
                  ...fetchOptions,
                }
              );

            if (authData) {
              return { data: authData, error: null };
            }

            // Fix error handling to properly extract message
            throw authError
              ? new Error(
                  authError.message ||
                    `Authentication failed: ${authError.statusText}`
                )
              : new Error("Authentication failed");
          } catch (error) {
            return {
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        /**
         * List passkeys for a user
         */
        listPasskeys: async (
          data: {
            userId: string;
            limit?: number;
            offset?: number;
          },
          fetchOptions?: BetterFetchOption
        ): Promise<ListPasskeysResult> => {
          try {
            if (!data.userId) {
              throw new PasskeyError(
                ERROR_CODES.SERVER.USER_NOT_FOUND,
                "userId is required"
              );
            }

            const { data: listData, error: listError } =
              await $fetch<ListPasskeysSuccessResponse>(
                `/expo-passkey/list/${data.userId}`,
                {
                  method: "GET",
                  credentials: "include",
                  headers: {
                    Accept: "application/json",
                    ...(fetchOptions?.headers as Record<string, string>),
                  },
                  query: {
                    limit: data.limit?.toString(),
                    offset: data.offset?.toString(),
                  },
                  ...fetchOptions,
                }
              );

            if (listData) {
              return { data: listData, error: null };
            }

            throw listError
              ? new Error(
                  listError.message ||
                    `Failed to retrieve passkeys: ${listError.statusText}`
                )
              : new Error("Failed to retrieve passkeys");
          } catch (error) {
            return {
              data: {
                passkeys: [],
                nextOffset: undefined,
              } as ListPasskeysSuccessResponse,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        /**
         * Revoke a passkey
         */
        revokePasskey: async (
          data: {
            credentialId: string;
            reason?: string;
          },
          fetchOptions?: BetterFetchOption
        ): Promise<RevokePasskeyResult> => {
          try {
            // Note: userId is no longer sent to server for security - server gets it from session
            const { data: revokeData, error: revokeError } = await $fetch<{
              success: boolean;
            }>("/expo-passkey/revoke", {
              method: "POST",
              body: {
                credentialId: data.credentialId,
                reason: data.reason,
              },
              ...fetchOptions,
            });

            if (revokeData && revokeData.success) {
              return { data: revokeData, error: null };
            }

            throw revokeError
              ? new Error(
                  revokeError.message ||
                    `Failed to revoke passkey: ${revokeError.statusText}`
                )
              : new Error("Failed to revoke passkey");
          } catch (error) {
            return {
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        /**
         * Check passkey registration for user
         */
        checkPasskeyRegistration: async (
          userId: string,
          fetchOptions?: BetterFetchOption
        ): Promise<PasskeyRegistrationCheckResult> => {
          try {
            const webAuthnSupported = await client.isWebAuthnSupported();

            if (!webAuthnSupported) {
              return {
                isRegistered: false,
                credentialIds: [],
                biometricSupport: null, // Not applicable for web
                error: new Error("WebAuthn not supported in this browser"),
              };
            }

            // Check with server
            const { data: passkeysData, error: passkeysError } =
              await $fetch<ListPasskeysSuccessResponse>(
                `/expo-passkey/list/${userId}`,
                {
                  method: "GET",
                  credentials: "include",
                  query: {
                    limit: "50",
                  },
                  ...fetchOptions,
                }
              );

            if (!passkeysData?.passkeys) {
              throw passkeysError
                ? new Error(
                    passkeysError.message ||
                      `Failed to retrieve passkey list: ${passkeysError.statusText}`
                  )
                : new Error("Failed to retrieve passkey list");
            }

            const passkeys = passkeysData.passkeys;
            const credentialIds = passkeys.map(
              (pk: { credentialId: string }) => pk.credentialId
            );

            return {
              isRegistered: credentialIds.length > 0,
              credentialIds,
              biometricSupport: null, // Not applicable for web
              error: null,
            };
          } catch (error) {
            return {
              isRegistered: false,
              credentialIds: [],
              biometricSupport: null,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        isPasskeySupported: async () => {
          return client.isWebAuthnSupported();
        },

        // Web doesn't have biometric info - return null
        getBiometricInfo: async () => {
          return null;
        },

        getDeviceInfo: async () => {
          return client.getDeviceInformation();
        },

        // Web doesn't use secure storage - return null
        getStorageKeys: () => {
          return null;
        },

        // Web doesn't have local passkey storage
        hasPasskeysRegistered: async (): Promise<boolean> => {
          return false;
        },

        hasUserPasskeysRegistered: async (
          _userId: string
        ): Promise<boolean> => {
          return false;
        },

        // Web doesn't have local credential storage
        removeLocalCredential: async (_credentialId: string): Promise<void> => {
          // No-op for web
        },

        // Web-specific functions
        isPlatformAuthenticatorAvailable: async () => {
          return isPlatformAuthenticatorAvailable();
        },
      };
    },

    fetchPlugins: [
      {
        id: "expo-passkey-plugin",
        name: "Expo Passkey Plugin",
        description: "Handles passkey authentication and error handling",
        version: "2.0.0",
        hooks: {
          onError: async (context: ErrorContext) => {
            if (context.response?.status === 401) {
              console.warn(
                "[ExpoPasskey] Authentication error in Expo Passkey plugin"
              );
            }
          },
        },
        init: async (url: string, options?: BetterFetchOption) => {
          try {
            const deviceInfo = await client.getDeviceInformation();
            const headers: Record<string, string> = {};

            // Copy existing headers if any
            if (options?.headers) {
              if (options.headers instanceof Headers) {
                // Handle real Headers object
                options.headers.forEach((value: string, key: string) => {
                  headers[key] = value;
                });
              } else if (Array.isArray(options.headers)) {
                // Handle array format
                (options.headers as Array<[string, string]>).forEach(
                  ([key, value]) => {
                    headers[key] = value;
                  }
                );
              } else if (
                typeof options.headers === "object" &&
                "forEach" in options.headers &&
                typeof (options.headers as unknown as { forEach: unknown })
                  .forEach === "function"
              ) {
                // Handle mock Headers object with forEach method
                (
                  options.headers as unknown as {
                    forEach: (
                      callback: (value: string, key: string) => void
                    ) => void;
                  }
                ).forEach((value: string, key: string) => {
                  headers[key] = value;
                });
              } else if (typeof options.headers === "object") {
                // Handle plain object
                Object.assign(headers, options.headers);
              }
            }

            // Add custom headers
            headers["X-Client-Type"] = "expo-passkey-web";
            headers["X-Client-Version"] = "2.0.0";
            headers["X-Platform"] = deviceInfo.platform;
            headers["X-Platform-Version"] = deviceInfo.osVersion;

            return {
              url,
              options: {
                ...options,
                headers,
              },
            };
          } catch (error) {
            console.warn("[ExpoPasskey] Could not add custom headers:", error);
            // Still return a valid response with at least basic headers
            return {
              url,
              options: {
                ...options,
                headers: {
                  ...((options?.headers as Record<string, string>) || {}),
                  "X-Client-Type": "expo-passkey-web",
                  "X-Client-Version": "2.0.0",
                },
              },
            };
          }
        },
      } satisfies BetterFetchPlugin,
    ],
  } satisfies BetterAuthClientPlugin;
};
