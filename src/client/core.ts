/**
 * @file Core implementation of the Expo Passkey client
 * @module expo-passkey/client/core
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
import {
  authenticateWithNativePasskey,
  createNativePasskey,
  isNativePasskeySupported,
} from "./native-module";
import { checkBiometricSupport } from "./utils/biometrics";
import { getDeviceInfo } from "./utils/device";
import {
  checkWebAuthnSupport,
  createAuthenticationOptions,
  createRegistrationOptions,
  setDeviceInfo,
} from "./utils/webauthn";

/**
 * Client implementation of the Expo Passkey plugin with WebAuthn support
 */
class ExpoPasskeyClient {
  private options: ExpoPasskeyClientOptions;
  private webAuthnSupport: ReturnType<typeof checkWebAuthnSupport>;

  constructor(options: ExpoPasskeyClientOptions = {}) {
    // Set defaults for options
    this.options = {
      storagePrefix: options.storagePrefix || "_better-auth",
      timeout: options.timeout || 60000, // 1 minute timeout by default
    };

    // Check WebAuthn support
    this.webAuthnSupport = checkWebAuthnSupport();
    setDeviceInfo(this.webAuthnSupport);
  }

  /**
   * Makes device info available to plugin actions
   */
  public async getDeviceInformation() {
    return getDeviceInfo(this.options);
  }

  /**
   * Get the client options
   */
  public getOptions() {
    return this.options;
  }

  /**
   * Check if WebAuthn is supported on this device
   */
  public async isWebAuthnSupported() {
    try {
      // First check platform requirements
      if (!this.webAuthnSupport.isSupported) {
        return false;
      }

      // Then check native module availability
      return await isNativePasskeySupported();
    } catch (_error) {
      // Prefix with _ to indicate intentional unused variable
      return false;
    }
  }
}

/**
 * Creates an instance of the Expo Passkey client plugin with WebAuthn support
 * @param options Configuration options for the client plugin
 * @returns Better Auth client plugin instance
 */
export const expoPasskeyClient = (options: ExpoPasskeyClientOptions = {}) => {
  // Create client
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
      // Define the challenge function first so it can be referenced by other actions
      const getChallenge = async (
        data: {
          userId: string;
          type: "registration" | "authentication";
        },
        fetchOptions?: BetterFetchOption,
      ): Promise<ChallengeResult> => {
        try {
          // Get challenge from server
          const { data: challengeData, error: challengeError } =
            await $fetch<ChallengeResponse>("/expo-passkey/challenge", {
              method: "POST",
              body: {
                userId: data.userId,
                type: data.type,
              },
              ...fetchOptions,
            });

          if (challengeData) {
            return { data: challengeData, error: null };
          }

          throw challengeError
            ? new Error(
                challengeError.message ||
                  `Failed to get challenge: ${challengeError.statusText}`,
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
        /**
         * Gets a WebAuthn challenge from the server
         */
        getChallenge,

        /**
         * Registers a new passkey for a user using WebAuthn
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
          fetchOptions?: BetterFetchOption,
        ): Promise<RegisterPasskeyResult> => {
          try {
            // Check if WebAuthn is supported
            const isSupported = await client.isWebAuthnSupported();
            if (!isSupported) {
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.NOT_SUPPORTED,
                "WebAuthn is not supported on this device",
              );
            }

            // Get device information
            const deviceInfo = await client.getDeviceInformation();

            // Check if biometric authentication is supported and enrolled
            const biometricSupport = await checkBiometricSupport();
            if (!biometricSupport.isSupported || !biometricSupport.isEnrolled) {
              throw new PasskeyError(
                ERROR_CODES.BIOMETRIC.NOT_ENROLLED,
                "Biometric authentication must be set up for passkey registration",
              );
            }

            // Get challenge from server
            const challengeResult = await getChallenge({
              userId: data.userId,
              type: "registration",
            });

            if (!challengeResult.data) {
              throw (
                challengeResult.error || new Error("Failed to get challenge")
              );
            }

            // Prepare registration options
            const registrationOptions = createRegistrationOptions(
              challengeResult.data.challenge,
              data.userId,
              data.userName,
              data.displayName || data.userName,
              data.rpId || "", // Will be provided by server response later
              data.rpName || "", // Will be provided by server response later
              {
                timeout: data.timeout || client.getOptions().timeout,
                attestation: data.attestation || "none",
                authenticatorSelection: data.authenticatorSelection || {
                  authenticatorAttachment: "platform",
                  userVerification: "required",
                  residentKey: "required",
                },
              },
            );

            // Invoke native module to create passkey
            const credential = await createNativePasskey({
              requestJson: JSON.stringify(registrationOptions),
            });

            // Make API request to register passkey
            const { data: registrationData, error: registrationError } =
              await $fetch<RegisterPasskeySuccessResponse>(
                "/expo-passkey/register",
                {
                  method: "POST",
                  body: {
                    userId: data.userId,
                    credential,
                    platform: deviceInfo.platform,
                    metadata: {
                      deviceName: deviceInfo.model,
                      deviceModel: deviceInfo.model,
                      appVersion: deviceInfo.appVersion,
                      manufacturer: deviceInfo.manufacturer,
                      biometricType: biometricSupport.authenticationType,
                      ...data.metadata,
                    },
                  },
                  ...fetchOptions,
                },
              );

            // Check if response was successful
            if (registrationData) {
              return { data: registrationData, error: null };
            }

            // If there was an error in the response
            throw registrationError
              ? new Error(
                  registrationError.message ||
                    `Registration failed: ${registrationError.statusText}`,
                )
              : new Error("Failed to register passkey");
          } catch (error) {
            return {
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        /**
         * Authenticates a user using a WebAuthn passkey
         */
        authenticateWithPasskey: async (
          data?: {
            userId?: string;
            rpId?: string;
            timeout?: number;
            userVerification?: "required" | "preferred" | "discouraged";
            metadata?: Partial<PasskeyMetadata>;
          },
          fetchOptions?: BetterFetchOption,
        ): Promise<AuthenticatePasskeyResult> => {
          try {
            // Check if WebAuthn is supported
            const isSupported = await client.isWebAuthnSupported();
            if (!isSupported) {
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.NOT_SUPPORTED,
                "WebAuthn is not supported on this device",
              );
            }

            // Get device information for metadata
            const deviceInfo = await client.getDeviceInformation();

            // If userId is provided, get challenge for that user
            // Otherwise, the native implementation will use a credential stored on the device
            let challenge = "";

            if (data?.userId) {
              const challengeResult = await getChallenge({
                userId: data.userId,
                type: "authentication",
              });

              if (!challengeResult.data) {
                throw (
                  challengeResult.error || new Error("Failed to get challenge")
                );
              }

              challenge = challengeResult.data.challenge;
            } else {
              // For discoverable credentials, we still need to get a challenge,
              // but we don't know the userId yet, so use a temporary identifier
              const challengeResult = await getChallenge({
                userId: "auto-discovery",
                type: "authentication",
              });

              if (!challengeResult.data) {
                throw (
                  challengeResult.error || new Error("Failed to get challenge")
                );
              }

              challenge = challengeResult.data.challenge;
            }

            // Create authentication options
            const authenticationOptions = createAuthenticationOptions(
              challenge,
              data?.rpId || "", // Will be filled from server side if not provided
              {
                timeout: data?.timeout || client.getOptions().timeout,
                userVerification: data?.userVerification || "required",
                // allowCredentials is not needed for auto-discovery
              },
            );

            // Invoke native module to authenticate with passkey
            const credential = await authenticateWithNativePasskey({
              requestJson: JSON.stringify(authenticationOptions),
            });

            // Make authentication request
            const { data: authData, error: authError } =
              await $fetch<AuthPasskeySuccessResponse>(
                "/expo-passkey/authenticate",
                {
                  method: "POST",
                  body: {
                    credential,
                    metadata: {
                      lastLocation: "mobile-app",
                      appVersion: deviceInfo.appVersion,
                      deviceModel: deviceInfo.model,
                      manufacturer: deviceInfo.manufacturer,
                      ...data?.metadata,
                    },
                  },
                  credentials: "include",
                  ...fetchOptions,
                },
              );

            // Check if response was successful
            if (authData) {
              return { data: authData, error: null };
            }

            // If there was an error in the response
            return {
              data: null,
              error: authError
                ? new Error(
                    authError.message ||
                      `Authentication failed: ${authError.statusText}`,
                  )
                : new Error(
                    "Authentication failed: Invalid or unexpected response format",
                  ),
            };
          } catch (error) {
            return {
              data: null,
              error: error instanceof Error ? error : new Error(String(error)),
            };
          }
        },

        /**
         * Lists passkeys for a user
         */
        listPasskeys: async (
          data: {
            userId: string;
            limit?: number;
            offset?: number;
          },
          fetchOptions?: BetterFetchOption,
        ): Promise<ListPasskeysResult> => {
          try {
            if (!data.userId) {
              throw new PasskeyError(
                ERROR_CODES.SERVER.USER_NOT_FOUND,
                "userId is required",
              );
            }

            // Make request to list passkeys
            const { data: listData, error: listError } =
              await $fetch<ListPasskeysSuccessResponse>(
                `/expo-passkey/list/${data.userId}`,
                {
                  method: "GET",
                  credentials: "include",
                  headers: {
                    Accept: "application/json",
                    ...fetchOptions?.headers,
                  },
                  query: {
                    limit: data.limit?.toString(),
                    offset: data.offset?.toString(),
                  },
                  ...fetchOptions,
                },
              );

            // Check if response was successful
            if (listData) {
              return { data: listData, error: null };
            }

            // If there was an error in the response
            throw listError
              ? new Error(
                  listError.message ||
                    `Failed to retrieve passkeys: ${listError.statusText}`,
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
         * Revokes a passkey
         */
        revokePasskey: async (
          data: {
            userId: string;
            credentialId: string;
            reason?: string;
          },
          fetchOptions?: BetterFetchOption,
        ): Promise<RevokePasskeyResult> => {
          try {
            // Make request to revoke passkey
            const { data: revokeData, error: revokeError } = await $fetch<{
              success: boolean;
            }>("/expo-passkey/revoke", {
              method: "POST",
              body: {
                userId: data.userId,
                credentialId: data.credentialId,
                reason: data.reason,
              },
              ...fetchOptions,
            });

            // Check if response was successful
            if (revokeData) {
              return { data: revokeData, error: null };
            }

            // If there was an error in the response
            throw revokeError
              ? new Error(
                  revokeError.message ||
                    `Failed to revoke passkey: ${revokeError.statusText}`,
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
         * Checks if passkey registration exists for a user
         */
        checkPasskeyRegistration: async (
          userId: string,
          fetchOptions?: BetterFetchOption,
        ): Promise<PasskeyRegistrationCheckResult> => {
          try {
            const biometricSupport = await checkBiometricSupport();
            const webAuthnSupported = await client.isWebAuthnSupported();

            if (!webAuthnSupported) {
              return {
                isRegistered: false,
                credentialIds: [],
                biometricSupport,
                error: new Error("WebAuthn not supported on this device"),
              };
            }

            const { data: passkeysData, error: passkeysError } =
              await $fetch<ListPasskeysSuccessResponse>(
                `/expo-passkey/list/${userId}`,
                {
                  method: "GET",
                  credentials: "include",
                  query: {
                    limit: "50", // Fetch up to 50 credentials to search through
                  },
                  ...fetchOptions,
                },
              );

            if (!passkeysData?.passkeys) {
              throw passkeysError
                ? new Error(
                    passkeysError.message ||
                      `Failed to retrieve passkey list: ${passkeysError.statusText}`,
                  )
                : new Error("Failed to retrieve passkey list");
            }

            const passkeys = passkeysData.passkeys;
            const credentialIds = passkeys.map(
              (pk: { credentialId: string }) => pk.credentialId,
            );

            return {
              isRegistered: credentialIds.length > 0,
              credentialIds,
              biometricSupport,
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

        /**
         * Checks if passkeys are supported on this device
         */
        isPasskeySupported: async () => {
          return client.isWebAuthnSupported();
        },

        /**
         * Gets biometric information for the device
         */
        getBiometricInfo: async () => {
          return checkBiometricSupport();
        },

        /**
         * Gets device information
         */
        getDeviceInfo: async () => {
          return client.getDeviceInformation();
        },

        /**
         * Gets the storage keys used by the plugin
         */
        getStorageKeys: () => {
          const prefix = client.getOptions().storagePrefix;
          return {
            DEVICE_ID: `${prefix}.device_id`,
            STATE: `${prefix}.passkey_state`,
            USER_ID: `${prefix}.user_id`,
          };
        },
      };
    },

    fetchPlugins: [
      {
        id: "expo-passkey-plugin",
        name: "Expo Passkey Plugin",
        description: "Handles passkey authentication and error handling",
        version: "1.0.0",
        hooks: {
          onError: async (context: ErrorContext) => {
            // Handle authentication errors
            if (context.response?.status === 401) {
              console.warn("Authentication error in Expo Passkey plugin");
            }
          },
        },
        init: async (url: string, options?: BetterFetchOption) => {
          try {
            // Add custom headers for diagnostics
            const deviceInfo = await client.getDeviceInformation();
            const headers: Record<string, string> = {};

            // Copy existing headers if any
            if (options?.headers) {
              if (options.headers instanceof Headers) {
                options.headers.forEach((value: string, key: string) => {
                  headers[key] = value;
                });
              } else if (Array.isArray(options.headers)) {
                options.headers.forEach(([key, value]: [string, string]) => {
                  headers[key] = value;
                });
              } else if (typeof options.headers === "object") {
                Object.assign(headers, options.headers);
              }
            }

            // Add custom headers
            headers["X-Client-Type"] = "expo-passkey";
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
            // If error occurs, return original URL and options
            console.warn("Could not add custom headers:", error);
            return { url, options };
          }
        },
      } satisfies BetterFetchPlugin,
    ],
  } satisfies BetterAuthClientPlugin;
};
