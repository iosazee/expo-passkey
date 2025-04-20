# Expo Passkey

<p align="center">
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue" alt="Platform iOS | Android" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue" alt="TypeScript Ready" />
  <img src="https://img.shields.io/badge/Status-Beta-yellow" alt="Beta Status" />
</p>

A Better Auth plugin enabling secure, passwordless authentication in Expo applications through native biometric authentication.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Platform Requirements](#platform-requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Usage Examples](#usage-examples)
- [Complete API Reference](#complete-api-reference)
- [Database Schema](#database-schema)
- [Database Optimizations](#database-optimizations)
- [UI Components](#ui-components)
- [Integration With Better Auth](#integration-with-better-auth)
- [Hooks and Patterns](#hooks-and-patterns)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Error Handling](#error-handling)
- [Bugs and Known Issues](#bugs-and-known-issues)
- [License](#license)

## Overview

Expo Passkey bridges the gap between Better Auth's backend capabilities and native biometric authentication on mobile devices. It allows your users to authenticate securely using Face ID, Touch ID, or fingerprint recognition without passwords, providing a modern, frictionless authentication experience.

This plugin implements WebAuthn-compliant passkey authentication by connecting Better Auth's backend infrastructure with native platform APIs (Apple's PassKeys and Android's Credential Manager), offering a complete end-to-end solution that you can integrate with minimal configuration.

### WebAuthn Integration

This package implements the WebAuthn (Web Authentication) standard for passkeys, providing:

- Full compliance with the WebAuthn specification
- Native integration with platform-specific APIs:
  - iOS: Uses Apple's ASAuthorizationPlatformPublicKeyCredentialProvider for secure passkey management
  - Android: Leverages the AndroidX Credentials API for credential management
- Support for both platform authenticators (biometrics) and cross-platform authenticators
- Proper credential storage and management with all security best practices

## Key Features

- ✅ **Seamless Integration**: Works directly with Better Auth server and Expo client
- ✅ **Native Biometrics**: Leverages Face ID, Touch ID, and fingerprint authentication
- ✅ **Cross-Platform**: Full support for iOS (16+) and Android (10+)
- ✅ **Complete Lifecycle Management**: Registration, authentication, and revocation flows
- ✅ **Type-Safe API**: Comprehensive TypeScript definitions and autocomplete
- ✅ **Secure Device Binding**: Ensures keys are bound to specific devices
- ✅ **Database Integration**: Automatically creates a MobilePasskey model in your database
- ✅ **Automatic Cleanup**: Optional automatic revocation of unused passkeys
- ✅ **Rich Metadata**: Store and retrieve device-specific context with each passkey
- ✅ **Custom UI Hooks**: Simplifies integration in your React Native UI

## Platform Requirements

| Platform | Minimum Version | Biometric Requirements |
|----------|----------------|------------------------|
| iOS      | iOS 16+        | Face ID or Touch ID configured |
| Android  | Android 10+ (API level 29+) | Fingerprint or Face Recognition configured |

## Installation

### Client Installation
In your expo app:
```bash
# Install the package
npm i expo-passkey

# Install peer dependencies (if not already installed)
npx expo install expo-application expo-local-authentication expo-secure-store expo-crypto expo-device
```

### Server Installation
In your auth server:
```bash
# Install the package
npm i expo-passkey

# Install peer dependencies (if not already installed)
npm install better-auth zod better-fetch
```

## Quick Start

1. **Add to Server**:
```typescript
import { betterAuth } from "better-auth";
import { expoPasskey } from "expo-passkey/server";

export const auth = betterAuth({
  plugins: [
    expoPasskey({
      rpId: "example.com",
      rpName: "Your App Name"
    })
  ]
});
```

2. **Migrate the Database**

Run the migration or generate the schema to add the necessary fields and tables to the database.

<details>
  <summary><strong>🚀 Migrate</strong></summary>

  ```bash
  npx @better-auth/cli migrate
  ```

</details>

<details>
  <summary><strong>⚙️ Generate</strong></summary>

  ```bash
  npx @better-auth/cli generate
  ```

</details>

See the [Schema](#database-schema) to add the fields manually.


3. **Add to Client**:
```typescript
import { createAuthClient } from "better-auth/client";
import { expoPasskeyClient } from "expo-passkey";

export const { 
  registerPasskey, 
  authenticateWithPasskey,
  isPasskeySupported
} = createAuthClient({
  plugins: [expoPasskeyClient()]
});
```


4. **Implement Authentication**:
```tsx
function PasskeyButton() {
  const handleAuth = async () => {
    const supported = await isPasskeySupported();
    if (!supported) {
      Alert.alert("Your device doesn't support passkeys");
      return;
    }
    
    try {
      const result = await authenticateWithPasskey();
      if (result.data) {
        // Authentication successful
        console.log("Authenticated user:", result.data.user);
      }
    } catch (error) {
      console.error("Authentication failed:", error);
    }
  };

  return <Button title="Sign in with Face ID" onPress={handleAuth} />;
}
```

## Detailed Setup

### Server Configuration

```typescript
import { betterAuth } from "better-auth";
import { expoPasskey } from "expo-passkey/server";

export const auth = betterAuth({
  // Other auth config...
  plugins: [
    // Other plugins...
    expoPasskey({
      rpId: "example.com",       // Required: Domain identifier
      rpName: "Your App Name",   // Required: Human-readable app name
      
      // Optional settings
      logger: {
        enabled: true,           // Enable detailed logging (default: true in dev)
        level: "debug",          // Log level: "debug", "info", "warn", "error"
      },
      rateLimit: {
        registerWindow: 300,     // Time window in seconds for rate limiting
        registerMax: 3,          // Max registration attempts in window
        authenticateWindow: 60,  // Time window for auth attempts
        authenticateMax: 5,      // Max auth attempts in window
      },
      cleanup: {
        inactiveDays: 30,        // Auto-revoke passkeys after 30 days of inactivity
        disableInterval: false,  // Set to true in serverless environments
      },
    }),
  ],
});
```

### Client Configuration

```typescript
import { createAuthClient } from "better-auth/client";
import { expoPasskeyClient } from "expo-passkey";

export const authClient = createAuthClient({
  baseURL: "https://api.example.com", // Your API base URL
  plugins: [
    expoPasskeyClient({
      storagePrefix: "your-app", // Optional storage key prefix (default: "_better-auth")
    }),
  ],
});

// Export actions for use throughout your app
export const {
  registerPasskey,
  authenticateWithPasskey,
  listPasskeys,
  revokePasskey,
  getBiometricInfo,
  isPasskeySupported,
  checkPasskeyRegistration,
  getStorageKeys,
} = authClient;
```

## Usage Examples

### Checking Device Compatibility

```typescript
import { isPasskeySupported, getBiometricInfo } from "./auth-client";

// Check if device supports passkeys
const supported = await isPasskeySupported();

if (supported) {
  // Get detailed information about biometric capabilities
  const deviceInfo = await getBiometricInfo();
  console.log(`Device supports ${deviceInfo.biometricSupport.authenticationType}`);
}
```

### Registering a New Passkey

```typescript
import { registerPasskey } from "./auth-client";

// Register a passkey for the user
// Will prompt for biometric verification
const result = await registerPasskey({
  userId: "user-123",
  metadata: {
    deviceName: "My iPhone",
    lastLocation: "registration-screen",
  },
});

if (result.error) {
  console.error("Registration failed:", result.error.message);
} else {
  console.log("Passkey registered successfully");
}
```

### Authenticating with a Passkey

```typescript
import { authenticateWithPasskey } from "./auth-client";

try {
  // Will prompt for biometric verification
  const result = await authenticateWithPasskey({
    metadata: {
      lastLocation: "login-screen",
    }
  });

  if (result.error) throw result.error;
  
  // Authentication successful
  const { user, token } = result.data;
  console.log("Authenticated user:", user);
  
  // Use token for authenticated API requests
  // ...
} catch (error) {
  console.error("Authentication failed:", error.message);
}
```

### Custom Passkey Status Hook

```typescript
import { useState, useEffect } from "react";
import { isPasskeySupported, checkPasskeyRegistration } from "./auth-client";

export function usePasskeyStatus(userId) {
  const [isSupported, setIsSupported] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        setLoading(true);
        
        // Check device support
        const supported = await isPasskeySupported();
        setIsSupported(supported);
        
        if (supported && userId) {
          // Check if device has registered passkey
          const result = await checkPasskeyRegistration(userId);
          setHasPasskey(result.isRegistered);
        }
      } catch (error) {
        console.error("Error checking passkey status:", error);
      } finally {
        setLoading(false);
      }
    }
    
    checkStatus();
  }, [userId]);

  return { isSupported, hasPasskey, loading };
}
```

### Comprehensive Passkeys Hook

```typescript
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPasskeys, getStorageKeys } from "./auth-client";
import * as SecureStore from "expo-secure-store";
import type { MobilePasskey } from "expo-passkey";

export function usePasskeys(userId) {
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  // Fetch current device ID
  const fetchDeviceId = async () => {
    try {
      const STORAGE_KEYS = getStorageKeys();
      const deviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);
      setCurrentDeviceId(deviceId);
      return deviceId;
    } catch (error) {
      console.error("Error fetching device ID:", error);
      return null;
    }
  };

  // Main query to fetch passkeys
  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["passkeys", userId],
    queryFn: async () => {
      // Make sure we have the current device ID
      await fetchDeviceId();

      // Call the listPasskeys function
      const result = await listPasskeys({ userId });
      if (result.error) throw result.error;
      return result;
    },
    enabled: !!userId,
  });

  // Process the result
  const passkeys = result?.data?.passkeys || [];
  const hasRegisteredPasskey = passkeys.length > 0;
  const currentDeviceHasPasskey = passkeys.some(
    (pk) => pk.deviceId === currentDeviceId
  );

  return {
    passkeys,
    hasRegisteredPasskey,
    currentDeviceHasPasskey,
    currentDeviceId,
    isLoading,
    refetch,
    error: error instanceof Error ? error : null,
  };
}
```

## Complete API Reference

### Client API

#### `registerPasskey(options): Promise<RegisterPasskeyResult>`

Registers a new passkey for a user. This will prompt for biometric authentication.

```typescript
interface RegisterOptions {
  userId: string;              // Required: User ID to associate with the passkey
  deviceId?: string;           // Optional: Override automatic device ID 
  metadata?: {                 // Optional: Additional metadata to store
    deviceName?: string;       // Device name (e.g. "John's iPhone")
    deviceModel?: string;      // Device model (e.g. "iPhone 14 Pro")
    appVersion?: string;       // App version
    lastLocation?: string;     // Context where registered (e.g. "settings-screen")
    manufacturer?: string;     // Device manufacturer
    brand?: string;            // Device brand
    biometricType?: string;    // Type of biometric used
    [key: string]: any;        // Any other custom metadata
  };
}

// Return type
interface RegisterPasskeyResult {
  data: { 
    success: boolean; 
    rpName: string;            // Relying party name from server config 
    rpId: string;              // Relying party ID from server config
  } | null;
  error: Error | null;
}
```

#### `authenticateWithPasskey(options?): Promise<AuthenticatePasskeyResult>`

Authenticates a user with a registered passkey. This will prompt for biometric authentication.

```typescript
interface AuthenticateOptions {
  deviceId?: string;           // Optional: Override automatic device ID
  metadata?: {                 // Optional: Additional metadata to update
    lastLocation?: string;     // Context where authentication occurred
    appVersion?: string;       // App version
    [key: string]: any;        // Any other custom metadata
  };
}

// Return type
interface AuthenticatePasskeyResult {
  data: { 
    token: string;             // Session token for authentication
    user: {                    // User object
      id: string;              // User ID
      email: string;           // User email
      [key: string]: any;      // Any other user properties
    };
  } | null;
  error: Error | null;
}
```

#### `listPasskeys(options): Promise<ListPasskeysResult>`

Lists all passkeys registered for a user. Useful for managing devices.

```typescript
interface ListOptions {
  userId: string;              // Required: User ID
  limit?: number;              // Optional: Pagination limit (default: 10)
  offset?: number;             // Optional: Pagination offset (default: 0)
}

// Return type
interface ListPasskeysResult {
  data: { 
    passkeys: Array<MobilePasskey>; // Array of passkey objects
    nextOffset?: number;       // Pagination offset for next page
  } | null;
  error: Error | null;
}

// MobilePasskey type
interface MobilePasskey {
  id: string;                  // Passkey ID
  userId: string;              // User ID
  deviceId: string;            // Device ID  
  platform: string;            // Platform (ios/android)
  lastUsed: string;            // ISO timestamp
  status: "active" | "revoked";
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
  revokedAt?: string;          // ISO timestamp (if revoked)
  revokedReason?: string;      // Reason for revocation
  metadata: string | Record<string, any>; // Parsed metadata or JSON string
}
```

#### `revokePasskey(options): Promise<RevokePasskeyResult>`

Revokes a passkey, preventing it from being used for authentication.

```typescript
interface RevokeOptions {
  userId: string;              // Required: User ID
  deviceId?: string;           // Optional: Override automatic device ID
  reason?: string;             // Optional: Reason for revocation
}

// Return type
interface RevokePasskeyResult {
  data: { success: boolean } | null;
  error: Error | null;
}
```

#### `checkPasskeyRegistration(userId: string): Promise<PasskeyRegistrationCheckResult>`

Checks if the current device has a registered passkey for the given user.

```typescript
// Return type
interface PasskeyRegistrationCheckResult {
  isRegistered: boolean;       // Whether device has a registered passkey
  deviceId: string | null;     // Device ID
  biometricSupport: BiometricSupportInfo | null; // Biometric support info
  error: Error | null;         // Error if any
}
```


#### `isPasskeyRegistered()`

Checks if the device has a valid registered passkey by verifying both device ID and user ID are present in secure storage.

```typescript
// Check if the current device has a registered passkey
const hasPasskey = await hasRegisteredPasskey();
if (hasPasskey) {
  console.log("This device has a registered passkey");
  //carry out some action eg conditionally show passkey login button
} else {
  console.log("No passkey registered on this device");
}
```

#### `getBiometricInfo(): Promise<DeviceInfo>`

Gets information about the device's biometric capabilities, platform, and configuration.

```typescript
// Return type
interface DeviceInfo {
  deviceId: string;            // Unique device identifier
  platform: "ios" | "android"; // Device platform
  model: string | null;        // Device model (e.g. "iPhone 14")
  manufacturer: string | null; // Device manufacturer (e.g. "Apple")
  osVersion: string;           // OS version (e.g. "16.0")
  appVersion: string;          // App version
  biometricSupport: {
    isSupported: boolean;      // Whether biometrics are supported
    isEnrolled: boolean;       // Whether biometrics are set up
    availableTypes: number[];  // Available authentication types
    authenticationType: string; // Human-readable type (e.g. "Face ID")
    error: string | null;      // Error message if any
    platformDetails: {         // Platform-specific details
      platform: string;
      version: string | number;
      apiLevel?: number | null; // Android API level
      manufacturer?: string | null;
      brand?: string | null;
    }
  };
}
```

#### `isPasskeySupported(): Promise<boolean>`

Checks if passkeys are supported on the current device based on platform, OS version, and biometric capabilities.

```typescript
// Returns: boolean
// true if the device supports passkeys, false otherwise
```

#### `getStorageKeys(): StorageKeys`

Gets the storage keys used by the plugin for secure storage.

```typescript
// Return type
interface StorageKeys {
  DEVICE_ID: string;           // Key for device ID in SecureStore
  STATE: string;               // Key for state in SecureStore
  USER_ID: string;             // Key for user ID in SecureStore
}
```

### Server API

#### `expoPasskey(options): BetterAuthPlugin`

Creates a server-side plugin for handling passkey operations.

```typescript
interface ExpoPasskeyOptions {
  rpId: string;                // Required: Relying Party ID (domain)
  rpName: string;              // Required: Human-readable app name
  
  // Optional settings
  logger?: {
    enabled?: boolean;         // Enable logging (default: true in dev)
    level?: "debug" | "info" | "warn" | "error"; // Log level
  };
  
  rateLimit?: {
    registerWindow?: number;   // Time window for rate limiting (seconds)
    registerMax?: number;      // Max registration attempts in window
    authenticateWindow?: number; // Time window for auth attempts
    authenticateMax?: number;  // Max auth attempts in window
  };
  
  cleanup?: {
    inactiveDays?: number;     // Days after which to revoke inactive passkeys
    disableInterval?: boolean; // Disable automatic cleanup (for serverless)
  };
}
```

## Database Schema

The plugin requires a new table in the database to store biometric data.
- Table Name 📱: `mobilePasskey` 

| **Field Name**   | **Type**                | **Key** | **Description**                                      |
|------------------|--------------------------|--------|------------------------------------------------------|
| `id`             | `string`                | PK     | Unique identifier for each mobile passkey            |
| `userId`         | `string`                | FK     | The ID of the user (references `user.id`)            |
| `deviceId`       | `string`                | -      | Identifier of the registered device                  |
| `platform`       | `string` (`ios`/`android`) | -   | Platform on which the passkey was registered         |
| `lastUsed`       | `string` (ISO timestamp) | -     | The last time the passkey was used                   |
| `status`         | `"active"` \| `"revoked"` | -    | Current status of the passkey                        |
| `createdAt`      | `string`                  | -      | Time when the passkey was created                    |
| `updatedAt`      | `string`                  | -      | Time when the passkey was last updated               |
| `revokedAt`      | `string` (optional)     | -      | Timestamp when the passkey was revoked (if any)      |
| `revokedReason`  | `string` (optional)     | -      | Reason for revocation (if any)                       |
| `metadata`       | `string` (JSON)         | -      | JSON string containing metadata about the device     |

## Database Optimizations

Optimizing database performance is essential to get the best out of the Expo Passkey plugin.

### Recommended Fields to Index

- **Single field indexes**:
  - `userId`: For fast lookups of a user's passkeys.
  - `lastUsed`: For efficient sorting and cleanup operations.
  - `status`: For filtering by active/revoked status.

- **Compound indexes**:
  - `(deviceId, status)`: Optimizes the authentication endpoint.
  - `(userId, status)`: Accelerates the passkey listing endpoint.
  - `(lastUsed, status)`: Improves performance of cleanup operations.


## UI Components

Here are examples of useful UI components you can create to work with this package:

### PasskeyRegistrationButton Component

```tsx
import React, { useState, useEffect } from "react";
import { View, Pressable, ActivityIndicator, Platform, Alert, Linking } from "react-native";
import { Text } from "./ui/text";
import { registerPasskey, getBiometricInfo } from "../lib/auth-client";
import * as Application from "expo-application";

export const PasskeyRegistration = ({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete?: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [biometricInfo, setBiometricInfo] = useState(null);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const deviceInfo = await getBiometricInfo();
      setBiometricInfo(deviceInfo.biometricSupport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check biometric status");
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError("");

      const metadata = {
        lastLocation: "security-settings",
        appVersion: Application.nativeApplicationVersion || "1.0.0",
      };

      // Use the package's registerPasskey function
      const result = await registerPasskey({
        userId,
        metadata,
      });

      if (result.error) {
        throw result.error;
      }

      Alert.alert(
        "Success",
        `${biometricInfo.authenticationType} has been successfully registered for quick sign-in`,
        [{ text: "OK", onPress: () => onComplete?.() }]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register passkey");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text className="text-lg font-semibold">
        Enable {biometricInfo?.authenticationType || "Biometric"} Sign-in
      </Text>
      <Text className="text-muted-foreground">
        Use {biometricInfo?.authenticationType || "biometrics"} for quick and secure sign-in
      </Text>

      {error ? (
        <View className="bg-destructive/10 p-4 rounded-md mt-4">
          <Text className="text-destructive">{error}</Text>
        </View>
      ) : null}

      <Pressable
        className="h-12 items-center justify-center rounded-md bg-primary mt-4"
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold">
            Register {biometricInfo?.authenticationType || "Passkey"}
          </Text>
        )}
      </Pressable>
    </View>
  );
};
```

### PasskeyLoginButton Component

```tsx
import React, { useState, useEffect } from "react";
import { Pressable, View, ActivityIndicator } from "react-native";
import { Text } from "./ui/text";
import { authenticateWithPasskey, getBiometricInfo, getStorageKeys } from "../lib/auth-client";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Key } from "lucide-react-native";

export function PasskeyLoginButton({
  onSuccess,
  onError,
}) {
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    checkPasskeyAvailability();
  }, []);

  const checkPasskeyAvailability = async () => {
    try {
      // Get biometric info from the package
      const deviceInfo = await getBiometricInfo();
      const biometricSupport = deviceInfo.biometricSupport;

      // Get the STORAGE_KEYS from the package
      const STORAGE_KEYS = getStorageKeys();
      const storedDeviceId = await SecureStore.getItemAsync(STORAGE_KEYS.DEVICE_ID);

      // Platform-specific checks
      let platformSupported = true;
      if (Platform.OS === "ios") {
        const version = parseInt(Platform.Version, 10);
        if (version < 16) platformSupported = false;
      } else if (Platform.OS === "android") {
        const apiLevel = biometricSupport.platformDetails.apiLevel;
        if (!apiLevel || apiLevel < 29) platformSupported = false;
      }

      // Only show if everything is supported and we have a registered passkey
      setIsAvailable(
        platformSupported && 
        biometricSupport.isSupported && 
        biometricSupport.isEnrolled && 
        !!storedDeviceId
      );
    } catch (error) {
      console.error("Error checking passkey availability:", error);
      setIsAvailable(false);
    }
  };

  const handlePasskeyAuth = async () => {
    try {
      setLoading(true);
      const result = await authenticateWithPasskey();

      if (result.error) {
        throw result.error;
      }

      if (onSuccess) onSuccess();
      
      // Navigate after authentication
      router.replace("/dashboard");
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not available
  if (!isAvailable) return null;

  return (
    <Pressable
      className="h-12 w-full items-center justify-center rounded-md border border-border"
      onPress={handlePasskeyAuth}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#007AFF" />
      ) : (
        <View className="flex-row items-center">
          <Key size={20} color="#000" />
          <Text className="font-semibold ml-2">Sign in with Passkey</Text>
        </View>
      )}
    </Pressable>
  );
}
```

## Integration With Better Auth

### Configuring in a Next.js Backend

Here's how to integrate with Better Auth:

```typescript
import { betterAuth } from "better-auth";
import { passkey } from "better-auth/plugins/passkey";
import { emailOTP, admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { expoPasskey } from "expo-passkey/server";
import { db } from "./lib/db";

const isDevEnvironment = process.env.NODE_ENV === "development";
const domain = isDevEnvironment ? "localhost" : "yourdomain.com";

export const auth = betterAuth({
  appName: "Your App",
  database: prismaAdapter(db),
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [
    "https://yourdomain.com",
    "yourdomain://", // Deep linking scheme
    "exp+yourdomain://", // Expo linking scheme
    ...(isDevEnvironment ? ["http://localhost:3000"] : []),
  ],
  plugins: [
    // Web passkey support
    passkey({
      rpID: domain,
      rpName: "Your App",
      origin: isDevEnvironment ? "http://localhost:3000" : "https://yourdomain.com",
    }),
    // Expo passkey support (biometric auth for mobile)
    expoPasskey({
      rpId: domain,
      rpName: "Your App",
      logger: {
        enabled: true,
        level: "debug",
      },
    }),
    // Other auth plugins
    emailOTP({
      // Email OTP configuration
    }),
    admin(),
    nextCookies(),
  ],
});
```
for more information see https://www.better-auth.com/docs/integrations/next

### Setting Up Client Instance in your expo app

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/client";
import { expoPasskeyClient } from "expo-passkey";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [expoPasskeyClient()],
});

export const { 
  registerPasskey, 
  authenticateWithPasskey, 
  listPasskeys,
  revokePasskey,
  getBiometricInfo,
  isPasskeySupported,
  checkPasskeyRegistration,
  getStorageKeys,
  // Other auth functions from Better Auth
  signIn,
  signOut,
  signUp,
  // ...
} = authClient;
```
for more information see https://www.better-auth.com/docs/integrations/expo

## Hooks and Patterns

### PasskeyManager Component

A complete example of a PasskeyManager component for displaying and managing passkeys:

```tsx
import React, { useState } from "react";
import { View, FlatList, Alert, ActivityIndicator } from "react-native";
import { Text, Card, Button } from "../ui/components";
import { usePasskeys } from "../hooks/use-passkeys";
import { revokePasskey, getStorageKeys } from "../lib/auth-client";
import * as SecureStore from "expo-secure-store";
import { queryClient } from "../lib/query-client";
import { PasskeyRegistration } from "./passkey-registration";

export function PasskeyManager({ userId }) {
  const [revoking, setRevoking] = useState(null);
  
  const {
    passkeys,
    hasRegisteredPasskey,
    currentDeviceHasPasskey,
    currentDeviceId,
    isLoading,
    refetch,
  } = usePasskeys(userId);

  const handleRevokePasskey = async (deviceId) => {
    Alert.alert(
      "Remove Passkey",
      "Are you sure you want to remove this passkey?",
      [
        { text: "Cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRevoking(deviceId);
              const result = await revokePasskey({
                userId,
                deviceId,
                reason: "user_requested",
              });

              if (result.error) throw result.error;

              // If this is the current device, clear the device ID
              if (currentDeviceId === deviceId) {
                const STORAGE_KEYS = getStorageKeys();
                await SecureStore.deleteItemAsync(STORAGE_KEYS.DEVICE_ID);
              }

              // Update UI
              queryClient.invalidateQueries({ queryKey: ["passkeys", userId] });
              Alert.alert("Success", "Passkey has been removed successfully");
            } catch (error) {
              Alert.alert("Error", "Failed to remove passkey. Please try again.");
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View>
      <Text className="text-xl font-bold mb-4">Passkey Authentication</Text>
      
      {!currentDeviceHasPasskey && (
        <Card className="mb-4 p-4">
          <Text className="font-semibold mb-2">Enable Passkey Authentication</Text>
          <Text className="text-muted-foreground mb-4">
            Set up biometric authentication for faster sign-in on this device.
          </Text>
          <PasskeyRegistration 
            userId={userId} 
            onComplete={refetch} 
          />
        </Card>
      )}

      {passkeys.length > 0 ? (
        <>
          <Text className="font-semibold mb-2">Your Registered Devices</Text>
          <FlatList
            data={passkeys}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              // Parse metadata
              let metadata = {};
              if (typeof item.metadata === "string") {
                try {
                  metadata = JSON.parse(item.metadata);
                } catch (error) {
                  console.error("Error parsing metadata:", error);
                }
              } else if (item.metadata && typeof item.metadata === "object") {
                metadata = item.metadata;
              }

              const isCurrentDevice = item.deviceId === currentDeviceId;
              
              return (
                <Card className="mb-2 p-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-semibold">
                      {metadata.deviceName || metadata.deviceModel || 
                        (item.platform === "ios" ? "iOS Device" : "Android Device")}
                    </Text>
                    {isCurrentDevice && (
                      <View className="bg-primary/10 px-2 py-1 rounded">
                        <Text className="text-xs text-primary">Current Device</Text>
                      </View>
                    )}
                  </View>
                  
                  <View className="space-y-1 mb-3">
                    <Text className="text-sm">
                      Platform: {item.platform === "ios" ? "iOS" : "Android"}
                    </Text>
                    <Text className="text-sm">
                      Authentication: {metadata.biometricType || "Biometric"}
                    </Text>
                    <Text className="text-sm">
                      Last used: {new Date(item.lastUsed).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  {isCurrentDevice && (
                    <Button 
                      variant="destructive"
                      onPress={() => handleRevokePasskey(item.deviceId)}
                      disabled={revoking === item.deviceId}
                    >
                      {revoking === item.deviceId ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        "Remove This Passkey"
                      )}
                    </Button>
                  )}
                </Card>
              );
            }}
          />
        </>
      ) : (
        <View className="items-center justify-center p-8 bg-muted/20 rounded-lg">
          <Text className="text-center text-muted-foreground">
            No passkeys registered. Register a passkey to enable biometric sign-in.
          </Text>
        </View>
      )}
    </View>
  );
}
```

## Troubleshooting

### iOS Issues

- **iOS Version Requirements**: Must be running iOS 16+ for passkey support
- **Biometric Setup**: Ensure Face ID/Touch ID is configured in device settings
- **Simulator Limitations**: Biometric authentication in simulators requires additional setup:
  - In the simulator, go to Features → Face ID/Touch ID → Enrolled
  - When prompted, select "Matching Face/Fingerprint" for success testing
- **Device ID Generation**: iOS uses vendor ID from `expo-application`
- **Device Changes**: If a user resets Face ID/Touch ID, passkeys need re-registration

### Android Issues

- **API Level**: Must be running Android 10+ (API level 29+)
- **Biometric Hardware**: Device must have fingerprint or facial recognition hardware
- **Configuration**: Biometric authentication must be set up in device settings
- **Emulator Testing**: Configure fingerprint in emulator settings (AVD Manager):
  - In AVD settings, enable fingerprint
  - Use "adb -e emu finger touch 1" command to simulate fingerprint
- **Fragmentation**: Behavior may vary across manufacturers

### Common Issues

1. **"Device ID not found" error**:
   - The device doesn't have a registered passkey
   - Solution: Register a passkey for the device first

2. **"Biometric authentication failed" error**:
   - User canceled biometric prompt or failed authentication
   - Solution: Retry authentication or offer alternative login method

3. **"Invalid credential" error**:
   - The passkey has been revoked or doesn't exist
   - Solution: Re-register passkey

4. **"Registration failed" error**:
   - Check if the user exists in your database
   - Ensure rpId matches your domain
   - Check server logs for specific errors

### Diagnostic Tools

1. **Device Compatibility Check**:
   ```javascript
   const info = await getBiometricInfo();
   console.log(JSON.stringify(info, null, 2));
   ```

2. **Storage Check**:
   ```javascript
   import * as SecureStore from 'expo-secure-store';
   const keys = getStorageKeys();
   const deviceId = await SecureStore.getItemAsync(keys.DEVICE_ID);
   console.log("Current Device ID:", deviceId);
   ```

3. **Clear Device ID** (for testing):
   ```javascript
   import * as SecureStore from 'expo-secure-store';
   const keys = getStorageKeys();
   await SecureStore.deleteItemAsync(keys.DEVICE_ID);
   ```

4. **Server Logs**: Enable debug logging on the server:
   ```javascript
   expoPasskey({
     // ...other options
     logger: { enabled: true, level: "debug" }
   })
   ```


## Security Considerations

- **Device Binding**: Passkeys are bound to specific devices for security
- **Biometric Data**: Biometric data never leaves the device
- **Token Security**: Use HTTPS for all API communications
- **Rate Limiting**: Configure appropriate rate limits to prevent brute force attacks
- **Automatic Cleanup**: Enable cleanup to revoke unused passkeys periodically
- **Multiple Devices**: Allow users to register multiple devices for convenience
- **Fallback Authentication**: Always provide alternate authentication methods
- **Revocation**: Users should be able to revoke passkeys from all devices
- **Metadata Handling**: Be careful with what you store in metadata to avoid privacy concerns

## Error Handling

The package provides specific error codes for different scenarios:

```typescript
// Environment errors
ERROR_CODES.ENVIRONMENT.NOT_SUPPORTED     // Device/platform not supported
ERROR_CODES.ENVIRONMENT.MODULE_NOT_FOUND  // Required Expo module missing

// Biometric errors
ERROR_CODES.BIOMETRIC.NOT_SUPPORTED       // Device lacks biometric hardware
ERROR_CODES.BIOMETRIC.NOT_ENROLLED        // Biometrics not set up on device
ERROR_CODES.BIOMETRIC.AUTHENTICATION_FAILED // User failed/cancelled verification

// Device errors
ERROR_CODES.DEVICE.ID_GENERATION_FAILED   // Could not generate device ID

// Server errors
ERROR_CODES.SERVER.CREDENTIAL_EXISTS      // Passkey already registered
ERROR_CODES.SERVER.INVALID_CREDENTIAL     // Passkey not found
ERROR_CODES.SERVER.CREDENTIAL_NOT_FOUND   // Passkey doesn't exist
ERROR_CODES.SERVER.AUTHENTICATION_FAILED  // Authentication failed
ERROR_CODES.SERVER.USER_NOT_FOUND         // User not found
```

Example error handling pattern:

```typescript
try {
  const result = await authenticateWithPasskey();
  if (result.error) {
    // Handle specific error types
    if (result.error.code === ERROR_CODES.BIOMETRIC.AUTHENTICATION_FAILED) {
      showAuthFailedMessage();
    } else if (result.error.code === ERROR_CODES.SERVER.INVALID_CREDENTIAL) {
      promptReregistration();
    } else {
      // Generic error handling
      showErrorMessage(result.error.message);
    }
    return;
  }
  
  // Handle success
  handleSuccessfulAuthentication(result.data);
} catch (error) {
  // Catch unexpected errors
  console.error("Unexpected error:", error);
  showGenericErrorMessage();
}
```

## Bugs and Known Issues

As the package is currently in beta, there may be unexpected bugs or incomplete features. Please report any issues you encounter on our [Github issues page](https://github.com/iosazee/expo-passkey/issues).

Known issues include:

- **Expo Go Limitations**: Due to how Expo Go manages native modules, passkey functionality requires a development build or production build
- **Android Compatibility**: Some Android devices may not support passkeys despite meeting the API level requirements
- **iOS Simulator**: Biometric authentication in iOS simulators may not work consistently
- **Error Messages**: Some error messages may not be descriptive enough
- **Storage Persistence**: On some devices, SecureStore may be cleared when app is uninstalled

We appreciate your feedback and contributions to improve stability and functionality.

## License

MIT

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [Better Auth Documentation](https://www.better-auth.com/docs/integrations/expo)
- [Expo Local Authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [FIDO2 WebAuthn](https://webauthn.guide/)