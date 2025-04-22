/**
 * @file Storage utilities
 * @module expo-passkey/utils/storage
 */

import type { ExpoPasskeyClientOptions, StorageKeys } from "../../types/client";
import { loadExpoModules } from "./modules";

/**
 * Credential metadata stored with each credential ID
 */
export interface CredentialMetadata {
  userId: string;
  credentialId: string;
  rpId?: string;
  registeredAt: string;
  lastUsedAt: string;
  deviceName?: string;
  displayName?: string;
}

// Helper function to get modules only when needed
function getModules() {
  return loadExpoModules();
}

/**
 * Gets storage keys based on the client options
 * @param options Client options with optional storage prefix
 * @returns Storage keys with the configured prefix
 */
export function getStorageKeys(
  options: ExpoPasskeyClientOptions = {},
): StorageKeys {
  const prefix = options.storagePrefix || "_better-auth";

  return {
    DEVICE_ID: `${prefix}.device_id`,
    STATE: `${prefix}.passkey_state`,
    USER_ID: `${prefix}.user_id`,
    CREDENTIAL_IDS: `${prefix}.credential_ids`,
  };
}

/**
 * Stores a credential ID with metadata in secure storage
 * @param credentialId The credential ID to store
 * @param userId The user ID associated with the credential
 * @param options Client options with optional storage prefix
 * @param additionalMetadata Additional metadata to store with the credential
 * @returns Promise resolving when credential is stored
 */
export async function storeCredentialId(
  credentialId: string,
  userId: string,
  options: ExpoPasskeyClientOptions = {},
  additionalMetadata: Partial<CredentialMetadata> = {},
): Promise<void> {
  try {
    const { SecureStore } = getModules();
    const KEYS = getStorageKeys(options);

    // Store the user ID
    await SecureStore.setItemAsync(KEYS.USER_ID, userId);

    // Get existing credential IDs
    const existingIdsStr = await SecureStore.getItemAsync(KEYS.CREDENTIAL_IDS);
    let credentials: Record<string, CredentialMetadata> = {};

    if (existingIdsStr) {
      try {
        credentials = JSON.parse(existingIdsStr);
      } catch (e) {
        console.warn("Failed to parse stored credential IDs:", e);
      }
    }

    const now = new Date().toISOString();

    // Add the new credential ID with its metadata
    credentials[credentialId] = {
      userId,
      credentialId,
      registeredAt: credentials[credentialId]?.registeredAt || now,
      lastUsedAt: now,
      ...additionalMetadata,
    };

    // Store the updated credential IDs
    await SecureStore.setItemAsync(
      KEYS.CREDENTIAL_IDS,
      JSON.stringify(credentials),
    );

    console.debug("[ExpoPasskey] Stored credential ID:", credentialId);
  } catch (error) {
    console.error("[ExpoPasskey] Error storing credential ID:", error);
    throw error;
  }
}

/**
 * Gets all stored credential metadata
 * @param options Client options with optional storage prefix
 * @returns Promise resolving to an object mapping credential IDs to their metadata
 */
export async function getCredentialMetadata(
  options: ExpoPasskeyClientOptions = {},
): Promise<Record<string, CredentialMetadata>> {
  try {
    const { SecureStore } = getModules();
    const KEYS = getStorageKeys(options);

    const existingIdsStr = await SecureStore.getItemAsync(KEYS.CREDENTIAL_IDS);
    if (!existingIdsStr) {
      return {};
    }

    try {
      return JSON.parse(existingIdsStr);
    } catch (e) {
      console.warn("[ExpoPasskey] Failed to parse stored credential IDs:", e);
      return {};
    }
  } catch (error) {
    console.error("[ExpoPasskey] Error getting credential metadata:", error);
    return {};
  }
}

/**
 * Gets credential IDs for a specific user
 * @param userId User ID to filter credentials by
 * @param options Client options with optional storage prefix
 * @returns Promise resolving to array of credential IDs for the user
 */
export async function getUserCredentialIds(
  userId: string,
  options: ExpoPasskeyClientOptions = {},
): Promise<string[]> {
  try {
    const credentials = await getCredentialMetadata(options);

    return Object.values(credentials)
      .filter((cred) => cred.userId === userId)
      .map((cred) => cred.credentialId);
  } catch (error) {
    console.error("[ExpoPasskey] Error getting user credential IDs:", error);
    return [];
  }
}

/**
 * Updates the last used timestamp for a credential
 * @param credentialId The credential ID to update
 * @param options Client options with optional storage prefix
 * @returns Promise resolving when credential is updated
 */
export async function updateCredentialLastUsed(
  credentialId: string,
  options: ExpoPasskeyClientOptions = {},
): Promise<void> {
  try {
    const { SecureStore } = getModules();
    const KEYS = getStorageKeys(options);

    // Get existing credential IDs
    const existingIdsStr = await SecureStore.getItemAsync(KEYS.CREDENTIAL_IDS);
    if (!existingIdsStr) {
      return;
    }

    let credentials: Record<string, CredentialMetadata> = {};
    try {
      credentials = JSON.parse(existingIdsStr);
    } catch (e) {
      console.warn("[ExpoPasskey] Failed to parse stored credential IDs:", e);
      return;
    }

    // Check if credential exists
    if (!credentials[credentialId]) {
      return;
    }

    // Update last used
    credentials[credentialId].lastUsedAt = new Date().toISOString();

    // Store updated credentials
    await SecureStore.setItemAsync(
      KEYS.CREDENTIAL_IDS,
      JSON.stringify(credentials),
    );

    console.debug(
      "[ExpoPasskey] Updated credential last used time:",
      credentialId,
    );
  } catch (error) {
    console.error(
      "[ExpoPasskey] Error updating credential last used time:",
      error,
    );
  }
}

/**
 * Removes a credential ID from storage
 * @param credentialId The credential ID to remove
 * @param options Client options with optional storage prefix
 * @returns Promise resolving when credential is removed
 */
export async function removeCredentialId(
  credentialId: string,
  options: ExpoPasskeyClientOptions = {},
): Promise<void> {
  try {
    const { SecureStore } = getModules();
    const KEYS = getStorageKeys(options);

    // Get existing credential IDs
    const existingIdsStr = await SecureStore.getItemAsync(KEYS.CREDENTIAL_IDS);
    if (!existingIdsStr) {
      return;
    }

    let credentials: Record<string, CredentialMetadata> = {};
    try {
      credentials = JSON.parse(existingIdsStr);
    } catch (e) {
      console.warn("[ExpoPasskey] Failed to parse stored credential IDs:", e);
      return;
    }

    // Remove the credential ID
    delete credentials[credentialId];

    // Update storage
    await SecureStore.setItemAsync(
      KEYS.CREDENTIAL_IDS,
      JSON.stringify(credentials),
    );

    console.debug("[ExpoPasskey] Removed credential ID:", credentialId);

    // If there are no more credentials, also remove the user ID
    if (Object.keys(credentials).length === 0) {
      await SecureStore.deleteItemAsync(KEYS.USER_ID);
    }
  } catch (error) {
    console.error("[ExpoPasskey] Error removing credential ID:", error);
    throw error;
  }
}

/**
 * Checks if a credential ID exists in storage
 * @param credentialId The credential ID to check
 * @param options Client options with optional storage prefix
 * @returns Promise resolving to boolean indicating if credential exists
 */
export async function hasCredentialId(
  credentialId: string,
  options: ExpoPasskeyClientOptions = {},
): Promise<boolean> {
  try {
    const credentials = await getCredentialMetadata(options);
    return !!credentials[credentialId];
  } catch (error) {
    console.error("[ExpoPasskey] Error checking credential ID:", error);
    return false;
  }
}

/**
 * Gets the user ID associated with a credential ID
 * @param credentialId The credential ID to get user ID for
 * @param options Client options with optional storage prefix
 * @returns Promise resolving to user ID or null if not found
 */
export async function getUserIdForCredential(
  credentialId: string,
  options: ExpoPasskeyClientOptions = {},
): Promise<string | null> {
  try {
    const credentials = await getCredentialMetadata(options);
    return credentials[credentialId]?.userId || null;
  } catch (error) {
    console.error("[ExpoPasskey] Error getting user ID for credential:", error);
    return null;
  }
}
