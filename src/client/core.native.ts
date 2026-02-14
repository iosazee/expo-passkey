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
import {
  getDeviceInfo,
  hasPasskeysRegistered,
  hasUserPasskeysRegistered,
} from "./utils/device";
import {
  storeCredentialId,
  getCredentialMetadata,
  updateCredentialLastUsed,
  getUserCredentialIds,
  removeCredentialId,
  type CredentialMetadata,
} from "./utils/storage";
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
   * Check if WebAuthn is supported on this device.
   * Native module result is cached at the module level in native-module.ts,
   * so repeated calls are free after the first one.
   */
  public isWebAuthnSupported(): boolean {
    if (!this.webAuthnSupport.isSupported) {
      return false;
    }
    return isNativePasskeySupported();
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
          // Get challenge from server
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
          fetchOptions?: BetterFetchOption
        ): Promise<RegisterPasskeyResult> => {
          try {
            // Check if WebAuthn is supported
            const isSupported = await client.isWebAuthnSupported();
            if (!isSupported) {
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.NOT_SUPPORTED,
                "WebAuthn is not supported on this device"
              );
            }

            // Get device information
            const deviceInfo = await client.getDeviceInformation();

            // Check if biometric authentication is supported and enrolled
            const biometricSupport = await checkBiometricSupport();
            if (!biometricSupport.isSupported || !biometricSupport.isEnrolled) {
              throw new PasskeyError(
                ERROR_CODES.BIOMETRIC.NOT_ENROLLED,
                "Biometric authentication must be set up for passkey registration"
              );
            }

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

            // Get rpId from data or client options
            const rpId = data.rpId || client.getOptions().rpId;
            if (!rpId) {
              console.error(
                "[ExpoPasskey] Missing rpId parameter - this is required for passkey registration"
              );
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.INVALID_STATE,
                "Missing required parameter: rpId must be provided either in registerPasskey() call or in client options"
              );
            }

            if (!data.rpName) {
              console.error(
                "[ExpoPasskey] Missing rpName parameter - this is required for passkey registration"
              );
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.INVALID_STATE,
                "Missing required parameter: rpName must be provided for passkey registration"
              );
            }

            // Prepare registration options
            const webAuthnOptions = createRegistrationOptions(
              challengeResult.data.challenge,
              data.userId,
              data.userName,
              data.displayName || data.userName,
              rpId,
              data.rpName,
              {
                timeout: data.timeout || client.getOptions().timeout,
                attestation: data.attestation || "none",
                authenticatorSelection: data.authenticatorSelection || {
                  authenticatorAttachment: "platform",
                  userVerification: "required",
                  residentKey: "required",
                },
              }
            );

            // Invoke native module to create passkey
            const credential = await createNativePasskey({
              requestJson: JSON.stringify(webAuthnOptions),
            });

            // Make API request to register passkey
            // Note: userId is no longer sent to server for security - server gets it from session
            const { data: registrationData, error: registrationError } =
              await $fetch<RegisterPasskeySuccessResponse>(
                "/expo-passkey/register",
                {
                  method: "POST",
                  body: {
                    credential,
                    platform: deviceInfo.platform,
                    metadata: {
                      deviceName: deviceInfo.model || undefined,
                      deviceModel: deviceInfo.model,
                      appVersion: deviceInfo.appVersion,
                      manufacturer: deviceInfo.manufacturer,
                      biometricType: biometricSupport.authenticationType,
                      ...data.metadata,
                    },
                  },
                  ...fetchOptions,
                }
              );

            // Check if response was successful
            if (registrationData) {
              // Store the credential ID for local tracking
              try {
                // Extract credential ID from the credential response
                const credentialId = credential.id;

                // Create additional metadata for the credential
                const credentialMetadata: Partial<CredentialMetadata> = {
                  rpId: registrationData.rpId,
                  deviceName: deviceInfo.model || undefined,
                  displayName: data.displayName || data.userName,
                  createdOnThisDevice: true, // This credential was created on this device
                };

                // Store in secure storage
                await storeCredentialId(
                  credentialId,
                  data.userId,
                  client.getOptions(),
                  credentialMetadata
                );

                // console.debug(
                //   "[ExpoPasskey] Stored credential after registration:",
                //   credentialId,
                // );
              } catch (storageError) {
                // Don't fail the registration if local storage fails
                console.warn(
                  "[ExpoPasskey] Failed to store credential ID, but registration was successful:",
                  storageError
                );
              }

              return { data: registrationData, error: null };
            }

            // If there was an error in the response
            throw registrationError
              ? new Error(
                  registrationError.message ||
                    `Registration failed: ${registrationError.statusText}`
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
          fetchOptions?: BetterFetchOption
        ): Promise<AuthenticatePasskeyResult> => {
          try {
            // Check if WebAuthn is supported
            const isSupported = await client.isWebAuthnSupported();
            if (!isSupported) {
              throw new PasskeyError(
                ERROR_CODES.WEBAUTHN.NOT_SUPPORTED,
                "WebAuthn is not supported on this device"
              );
            }

            // Get device information for metadata
            const deviceInfo = await client.getDeviceInformation();

            // Get locally stored credential IDs to help with authentication
            let storedCredentials: Record<string, CredentialMetadata> = {};
            let allowCredentials: Array<{ id: string; type: "public-key" }> =
              [];

            try {
              storedCredentials = await getCredentialMetadata(
                client.getOptions()
              );

              // If userId is provided, only include credentials for that user
              // Otherwise, leave empty for discoverable credential flow (shows account picker)
              if (data?.userId) {
                const userCredentialIds = await getUserCredentialIds(
                  data.userId,
                  client.getOptions()
                );
                allowCredentials = userCredentialIds.map((id) => ({
                  id,
                  type: "public-key",
                }));
              }

              // console.debug(
              //   `[ExpoPasskey] Using ${allowCredentials.length} stored credentials for authentication`,
              // );
            } catch (storageError) {
              console.warn(
                "[ExpoPasskey] Failed to get stored credentials:",
                storageError
              );
              // Continue with empty allowCredentials - the platform will use discoverable credentials
            }

            // If userId is provided, get challenge for that user
            // Otherwise, the native implementation will use a credential stored on the device
            let challenge = "";
            const challengeUserId = data?.userId || "auto-discovery";

            // Get a challenge from the server
            const challengeResult = await getChallenge({
              userId: challengeUserId,
              type: "authentication",
            });

            if (!challengeResult.data) {
              throw (
                challengeResult.error || new Error("Failed to get challenge")
              );
            }

            challenge = challengeResult.data.challenge;

            // Create authentication options
            const authenticationOptions = createAuthenticationOptions(
              challenge,
              data?.rpId || client.getOptions().rpId || "",
              {
                timeout: data?.timeout || client.getOptions().timeout,
                userVerification: data?.userVerification || "required",
                allowCredentials:
                  allowCredentials.length > 0 ? allowCredentials : undefined,
              }
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
                }
              );

            // Check if response was successful
            if (authData) {
              try {
                // Update local credential storage
                const credentialId = credential.id;

                // If we already have this credential, update its last used time
                if (storedCredentials[credentialId]) {
                  await updateCredentialLastUsed(
                    credentialId,
                    client.getOptions()
                  );
                } else if (authData.user?.id) {
                  // If this is a new credential, store it
                  // Note: If we're authenticating with a credential we don't have locally,
                  // it might be from another device, so mark as createdOnThisDevice=false
                  const credentialMetadata: Partial<CredentialMetadata> = {
                    displayName: authData.user.email || authData.user.id,
                    deviceName: deviceInfo.model || undefined,
                    createdOnThisDevice: false, // We're just syncing this from server
                  };

                  await storeCredentialId(
                    credentialId,
                    authData.user.id,
                    client.getOptions(),
                    credentialMetadata
                  );
                }
              } catch (storageError) {
                console.warn(
                  "[ExpoPasskey] Failed to update credential storage, but authentication was successful:",
                  storageError
                );
                // Continue anyway since authentication succeeded
              }

              return { data: authData, error: null };
            }

            // If there was an error in the response
            return {
              data: null,
              error: authError
                ? new Error(
                    authError.message ||
                      `Authentication failed: ${authError.statusText}`
                  )
                : new Error(
                    "Authentication failed: Invalid or unexpected response format"
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
          fetchOptions?: BetterFetchOption
        ): Promise<ListPasskeysResult> => {
          try {
            if (!data.userId) {
              throw new PasskeyError(
                ERROR_CODES.SERVER.USER_NOT_FOUND,
                "userId is required"
              );
            }

            // Make request to list passkeys
            const response = await $fetch<ListPasskeysSuccessResponse>(
              `/expo-passkey/list/${data.userId}`,
              {
                method: "GET",
                credentials: "include",
                headers: {
                  accept: "application/json",
                  ...(fetchOptions?.headers as Record<string, string>),
                },
                query: {
                  limit: data.limit?.toString(),
                  offset: data.offset?.toString(),
                },
                ...fetchOptions,
              }
            );

            const { data: listData, error: listError } = response as {
              data: ListPasskeysSuccessResponse | null;
              error: unknown;
            };

            // Check if response was successful
            if (listData) {
              // Sync passkeys with local storage
              try {
                const localCredentialIds = await getUserCredentialIds(
                  data.userId,
                  client.getOptions()
                );
                const serverPasskeys = listData.passkeys;

                for (const passkey of serverPasskeys) {
                  // If we don't have this credential locally, store it
                  if (!localCredentialIds.includes(passkey.credentialId)) {
                    // Try to parse metadata
                    let metadata: Record<string, string> = {};
                    if (typeof passkey.metadata === "string") {
                      try {
                        metadata = JSON.parse(passkey.metadata);
                      } catch (_e) {
                        // Ignore parsing errors
                      }
                    } else if (
                      passkey.metadata &&
                      typeof passkey.metadata === "object"
                    ) {
                      metadata = passkey.metadata as Record<string, string>;
                    }

                    // Store the credential locally
                    await storeCredentialId(
                      passkey.credentialId,
                      data.userId,
                      client.getOptions(),
                      {
                        deviceName:
                          metadata.deviceName ||
                          metadata.deviceModel ||
                          undefined,
                        displayName: metadata.displayName || data.userId,
                        lastUsedAt: passkey.lastUsed,
                        registeredAt: passkey.createdAt,
                        createdOnThisDevice: false, // Synced from server, not created here
                      }
                    );

                    // console.debug(
                    //   "[ExpoPasskey] Synced server credential to local storage:",
                    //   passkey.credentialId,
                    // );
                  }
                }
              } catch (storageError) {
                console.warn(
                  "[ExpoPasskey] Failed to sync passkeys with local storage:",
                  storageError
                );
                // Continue anyway since listing succeeded
              }

              return { data: listData, error: null };
            }

            // If there was an error in the response
            throw listError
              ? listError instanceof Error
                ? listError
                : new Error(`Failed to retrieve passkeys`)
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
            credentialId: string;
            reason?: string;
          },
          fetchOptions?: BetterFetchOption
        ): Promise<RevokePasskeyResult> => {
          try {
            // Make request to revoke passkey
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

            // Check if response was successful
            if (revokeData && revokeData.success) {
              // Also remove from local storage
              try {
                await removeCredentialId(
                  data.credentialId,
                  client.getOptions()
                );
                // console.debug(
                //   "[ExpoPasskey] Removed revoked credential from local storage:",
                //   data.credentialId,
                // );
              } catch (storageError) {
                console.warn(
                  "[ExpoPasskey] Failed to remove credential from local storage:",
                  storageError
                );
                // Continue anyway since server revocation succeeded
              }

              return { data: revokeData, error: null };
            }

            // If there was an error in the response
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
         * Checks if passkey registration exists for a user
         */
        checkPasskeyRegistration: async (
          userId: string,
          fetchOptions?: BetterFetchOption
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

            // Check server first for cross-platform sync
            const { data: passkeysData, error: passkeysError } =
              await $fetch<ListPasskeysSuccessResponse>(
                `/expo-passkey/list/${userId}`,
                {
                  method: "GET",
                  credentials: "include",
                  query: { limit: "50" },
                  ...fetchOptions,
                }
              );

            if (!passkeysData?.passkeys) {
              throw (
                passkeysError || new Error("Failed to retrieve passkey list")
              );
            }

            const passkeys = passkeysData.passkeys;
            const credentialIds = passkeys.map((pk) => pk.credentialId);
            const deviceInfo = await client.getDeviceInformation();

            // Sync ALL server credentials to local storage
            // This ensures cross-platform passkeys are locally available
            try {
              for (const passkey of passkeys) {
                let metadata: Record<string, string> = {};
                if (typeof passkey.metadata === "string") {
                  try {
                    metadata = JSON.parse(passkey.metadata);
                  } catch (_e) {
                    // Ignore parsing errors
                  }
                } else if (
                  passkey.metadata &&
                  typeof passkey.metadata === "object"
                ) {
                  metadata = passkey.metadata as Record<string, string>;
                }

                // Store credential locally (will update if exists)
                await storeCredentialId(
                  passkey.credentialId,
                  userId,
                  client.getOptions(),
                  {
                    deviceName:
                      metadata.deviceName || metadata.deviceModel || undefined,
                    displayName: metadata.displayName || userId,
                    lastUsedAt: passkey.lastUsed,
                    registeredAt: passkey.createdAt,
                    // Mark as cross-platform if not created on this platform
                    crossPlatform: passkey.platform !== deviceInfo.platform,
                    originalPlatform: passkey.platform,
                    createdOnThisDevice: false, // Synced from server, not created here
                  }
                );
              }
            } catch (storageError) {
              console.warn(
                "[ExpoPasskey] Failed to sync server credentials locally:",
                storageError
              );
              // Continue anyway - server credentials still work
            }

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
            CREDENTIAL_IDS: `${prefix}.credential_ids`,
          };
        },

        /**
         * Checks if this device has any registered passkeys
         */
        hasPasskeysRegistered: async (): Promise<boolean> => {
          return hasPasskeysRegistered(client.getOptions());
        },

        /**
         * Checks if a specific user has registered passkeys on this device
         */
        hasUserPasskeysRegistered: async (userId: string): Promise<boolean> => {
          return hasUserPasskeysRegistered(userId, client.getOptions());
        },

        /**
         * Helper function to remove a credential ID from local storage
         */
        removeLocalCredential: async (credentialId: string): Promise<void> => {
          try {
            await removeCredentialId(credentialId, client.getOptions());
          } catch (error) {
            console.error(
              "[ExpoPasskey] Failed to remove credential ID:",
              error
            );
            throw error;
          }
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
              console.warn(
                "[ExpoPasskey] Authentication error in Expo Passkey plugin"
              );
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
                (options.headers as Array<[string, string]>).forEach(
                  ([key, value]) => {
                    headers[key] = value;
                  }
                );
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
            console.warn("[ExpoPasskey] Could not add custom headers:", error);
            return { url, options };
          }
        },
      } satisfies BetterFetchPlugin,
    ],
  } satisfies BetterAuthClientPlugin;
};
