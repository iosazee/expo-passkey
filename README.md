# Expo Passkey

<p align="center">
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-blue" alt="Platform iOS | Android | Web" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue" alt="TypeScript Ready" />
  <img src="https://img.shields.io/badge/Status-STABLE-brightgreen" alt="Stable Status" />
</p>

This is a cross-platform Expo module and Better Auth plugin that brings passkey authentication to your Expo apps on **web, iOS, and Android**. Features a unified passkey table structure that works seamlessly across all platforms, making it perfect for both universal apps using react-native-web and projects with separate mobile and web frontends.

> **🚀 v0.3.6**: Now includes web support, unified table structure, **client-controlled WebAuthn preferences**, enhanced cross-platform passkey syncing, and **session-validated security** for registration and revocation!

## 📱 Example Project

Check out our comprehensive example implementation at [neb-starter](https://github.com/iosazee/neb-starter), which demonstrates how to use Expo Passkey across a full-stack application:

- **Backend**: Built with Next.js, showcasing server-side implementation
- **Mobile App**: Complete Expo mobile client with passkey authentication
- **Web App**: Full web implementation using the same codebase
- **Working Demo**: See passkey registration and authentication in action across platforms
- **Best Practices**: Demonstrates recommended implementation patterns

This starter kit provides a working reference that you can use as a foundation for your own projects or to understand how all the pieces fit together.

## 🎬 Video Demos

See Expo Passkey in action on different platforms:

### iOS Demo
[![Watch the iOS Demo](https://img.shields.io/badge/Watch-iOS%20Demo%20with%20Face%20ID-blue?style=for-the-badge&logo=apple)](https://server.nubialand.com/uploads/Expo-Passkey-Demo.mp4)

### Android Demo
[![Watch the Android Demo](https://img.shields.io/badge/Watch-Android%20Demo%20with%20Fingerprint-green?style=for-the-badge&logo=android)](https://server.nubialand.com/uploads/epk-demo.mp4)

### Cross-Platform Portability Demo
[![Watch the Cross-Platform Demo](https://img.shields.io/badge/Watch-Cross%20Platform%20Portability%20Demo-purple?style=for-the-badge&logo=webauthn)](https://server.nubialand.com/uploads/ios_web.mp4)

*These demos show the complete passkey experience from registration to authentication using biometric verification, including cross-platform passkey portability.*

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Platform Requirements](#platform-requirements)
- [Installation](#installation)
- [Platform Setup](#platform-setup)
  - [iOS Setup](#ios-setup)
  - [Android Setup](#android-setup)
  - [Web Setup](#web-setup)
- [Quick Start](#quick-start)
- [Complete API Reference](#complete-api-reference)
- [Database Schema](#database-schema)
- [Custom Schema Configuration](#custom-schema-configuration)
- [Cross-Platform Usage](#cross-platform-usage)
- [Client Preferences](#client-preferences)
- [Database Optimizations](#database-optimizations)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Error Handling](#error-handling)
- [License](#license)

## Overview

Expo Passkey bridges the gap between Better Auth's backend capabilities and cross-platform authentication on web, mobile, and native platforms. It allows your users to authenticate securely using Face ID, Touch ID, fingerprint recognition, or platform authenticators in web browsers, providing a modern, frictionless authentication experience.

This plugin implements a comprehensive FIDO2/WebAuthn passkey solution that connects Better Auth's backend infrastructure with platform-specific authentication capabilities, offering a complete end-to-end solution that works seamlessly across web, iOS, and Android with **client-controlled security preferences** and **cross-platform credential syncing**.

## Key Features

- ✅ **Cross-Platform Support**: Works on web browsers, iOS (16+), and Android (10+)
- ✅ **Unified Table Structure**: Single table works across web, mobile, and all platforms
- ✅ **Custom Schema Configuration**: Customize database table names to fit your existing structure
- ✅ **Universal App Ready**: Perfect for Expo + react-native-web projects and separate frontend architectures
- ✅ **Platform-Specific Optimization**: Native biometrics on mobile, WebAuthn in browsers
- ✅ **Client-Controlled Preferences**: Specify attestation, user verification, and authenticator requirements
- ✅ **Enterprise-Ready Security**: Support for direct attestation and required user verification
- ✅ **Cross-Platform Syncing**: Automatic support for iCloud Keychain, Google Password Manager, and hardware keys
- ✅ **Seamless Integration**: Works directly with Better Auth server and client
- ✅ **Complete Lifecycle Management**: Registration, authentication, and revocation flows
- ✅ **Type-Safe API**: Comprehensive TypeScript definitions and autocomplete
- ✅ **Secure Device Binding**: Ensures keys are bound to specific devices/platforms
- ✅ **Automatic Cleanup**: Optional automatic revocation of unused passkeys
- ✅ **Rich Metadata**: Store and retrieve device-specific context with each passkey
- ✅ **Portable Passkeys**: Supports iCloud Keychain, Google Password Manager, and hardware keys

## Platform Requirements

| Platform | Minimum Version | Authentication Requirements |
|----------|----------------|----------------------------|
| Web      | Modern browsers with WebAuthn | Platform authenticator or security key |
| iOS      | iOS 16+        | Face ID or Touch ID configured |
| Android  | Android 10+ (API level 29+) | Fingerprint or Face Recognition configured |

## Installation

### Client Installation
In your Expo app:
```bash
# Install the package
npm i expo-passkey

# Install peer dependencies (if not already installed)
npx expo install expo-application expo-local-authentication expo-secure-store expo-crypto expo-device

# For web support, also install:
npm install @simplewebauthn/browser
```

**Import Strategy**:
The package uses platform-specific entry points to prevent import conflicts:

```typescript
// ✅ Correct imports
import { expoPasskeyClient } from "expo-passkey/native";  // Mobile
import { expoPasskeyClient } from "expo-passkey/web";     // Web  
import { expoPasskey } from "expo-passkey/server";        // Server

// ❌ Avoid this - will show helpful error
import { expoPasskeyClient } from "expo-passkey";         // Guard rail
```

### Server Installation
In your auth server:
```bash
# Install the package
npm i expo-passkey

# Install peer dependencies (if not already installed)
npm install better-auth better-fetch @simplewebauthn/server zod
```

## Platform Setup

### iOS Setup

To enable passkeys on iOS, you need to associate your app with a domain:

1. **Host Apple App Site Association File**:
   
   Create an Apple App Site Association file at `https://<your_domain>/.well-known/apple-app-site-association`:

   ```json
   {
     "webcredentials": {
       "apps": ["<teamID>.<bundleID>"]
     }
   }
   ```

   Replace `<teamID>` with your Apple Developer Team ID and `<bundleID>` with your app's bundle identifier.

2. **Configure Your Expo App**:
   
   Add the associated domain to your `app.json`:

   ```json
   {
     "expo": {
       "ios": {
         "associatedDomains": ["webcredentials:your_domain"]
       }
     }
   }
   ```

3. **Configure Server Plugin**:
   
   Add your domain to the `origin` array in the expoPasskey options:

   ```typescript
   expoPasskey({
     rpId: "example.com",
     rpName: "Your App Name",
     origin: ["https://example.com"] // Your associated domain
   })
   ```

### Android Setup

To enable passkeys on Android:

1. **Host Asset Links JSON File**:
   
   Create an asset links file at `https://<your_domain>/.well-known/assetlinks.json`:

   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "<package_name>",
         "sha256_cert_fingerprints": ["<sha256_cert_fingerprint>"]
       }
     }
   ]
   ```

   You can generate this file using the [Digital Asset Links Tool](https://developers.google.com/digital-asset-links/tools/generator).

2. **Get the Android Origin Value**:
   
   For Android, the origin is derived from the SHA-256 hash of the APK signing certificate. Use this Python code to convert your SHA-256 fingerprint:

   ```python
   import binascii
   import base64
   
   fingerprint = '91:F7:CB:F9:D6:81:53:1B:C7:A5:8F:B8:33:CC:A1:4D:AB:ED:E5:09:C5'
   print("android:apk-key-hash:" + base64.urlsafe_b64encode(binascii.a2b_hex(fingerprint.replace(':', ''))).decode('utf8').replace('=', ''))
   ```

   Replace the value of `fingerprint` with your own.

3. **Configure Server Plugin**:
   
   Add the android origin to your expoPasskey options:

   ```typescript
   expoPasskey({
     rpId: "example.com",
     rpName: "Your App Name",
     origin: [
       "https://example.com", // Your website
       "android:apk-key-hash:<your-base64url-encoded-hash>" // Android app signature
     ]
   })
   ```

### Web Setup

Web setup is automatic when using the plugin in a browser environment. Ensure your site is served over HTTPS (required for WebAuthn) and that your server configuration includes your web domain in the `origin` array.

## Quick Start

1. **Add to Server**:
```typescript
import { betterAuth } from "better-auth";
import { expoPasskey } from "expo-passkey/server";

export const auth = betterAuth({
  plugins: [
    expoPasskey({
      rpId: "example.com",
      rpName: "Your App Name",
      origin: [
        "https://example.com",
        "android:apk-key-hash:<your-base64url-encoded-hash>"
      ]
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
      schema: {
        authPasskey: { modelName: "user_passkeys" },
        passkeyChallenge: { modelName: "auth_challenges" }
  }
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

See the [Schema](#database-schema) to add the models/fields manually.

3. **Add to Client**:

**For Mobile App (React Native/Expo)**:
```typescript
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { expoPasskeyClient } from "expo-passkey/native";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_AUTH_BASE_URL,
  plugins: [
    expoClient({
      scheme: "your-app",
      storagePrefix: "your_app",
      storage: SecureStore,
    }),
    expoPasskeyClient({
      storagePrefix: "your_app",
      rpId: "example.com",        // Recommended for native - prevents authentication errors
      timeout: 60000,              // Optional: WebAuthn operation timeout (default: 60000ms)
    }),
    // ... other plugins
  ],
});

export const {
  registerPasskey,
  authenticateWithPasskey,
  listPasskeys,
  revokePasskey,
  isPasskeySupported,
  getBiometricInfo,
  getDeviceInfo
} = authClient;
```

**For Web App (Next.js/React)**:
```typescript
import { createAuthClient } from "better-auth/react";
import { expoPasskeyClient } from "expo-passkey/web";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    expoPasskeyClient({
      rpId: "example.com",        // Optional - auto-detected from window.location.hostname
      timeout: 60000,              // Optional: WebAuthn operation timeout (default: 60000ms)
    }),
    // ... other plugins
  ],
});

export const {
  isPlatformAuthenticatorAvailable,
  registerPasskey,
  authenticateWithPasskey,
  listPasskeys,
  revokePasskey,
} = authClient;
```


## Complete API Reference

### Client API

#### Client Options

Configure the passkey client when initializing:

```typescript
interface ExpoPasskeyClientOptions {
  /**
   * Prefix for storage keys
   * @default '_better-auth'
   */
  storagePrefix?: string;

  /**
   * Timeout for WebAuthn operations in milliseconds
   * @default 60000 (1 minute)
   */
  timeout?: number;

  /**
   * Relying Party ID - the domain of your application
   * @default window.location.hostname (web) or undefined (native)
   * @example 'example.com'
   *
   * IMPORTANT: For native apps, this should match your server's rpId.
   * Can be overridden per-operation by passing rpId to registerPasskey()
   * or authenticateWithPasskey().
   */
  rpId?: string;
}
```

**Native App Example:**
```typescript
expoPasskeyClient({
  storagePrefix: "myapp",
  rpId: "example.com",     // Required for reliable native auth
  timeout: 60000,
})
```

**Web App Example:**
```typescript
expoPasskeyClient({
  rpId: "example.com",     // Optional - auto-detected from URL
  timeout: 60000,
})
```

#### `registerPasskey(options): Promise<RegisterPasskeyResult>`

Registers a new passkey for a user with full client preference control.

**⚠️ Authentication Required**: User must be authenticated before calling this function. The server validates the userId from the active session.

```typescript
interface RegisterOptions {
  userId: string;              // Required: User ID to associate with the passkey
  userName: string;            // Required: User name for the passkey
  displayName?: string;        // Optional: Display name (defaults to userName)
  rpId?: string;               // Optional: Relying Party ID (auto-detected on web)
  rpName?: string;             // Optional: Relying Party name
  attestation?: "none" | "indirect" | "direct" | "enterprise";
  authenticatorSelection?: {   // Optional: Authenticator selection criteria
    authenticatorAttachment?: "platform" | "cross-platform";
    residentKey?: "required" | "preferred" | "discouraged";
    requireResidentKey?: boolean;
    userVerification?: "required" | "preferred" | "discouraged";
  };
  timeout?: number;            // Optional: Timeout in milliseconds
  
  metadata?: {                 // Optional: Additional metadata to store
    deviceName?: string;       // Device name (e.g. "John's iPhone")
    deviceModel?: string;      // Device model (e.g. "iPhone 14 Pro")
    appVersion?: string;       // App version
    lastLocation?: string;     // Context where registered
    manufacturer?: string;     // Device manufacturer
    brand?: string;            // Device brand
    biometricType?: string;    // Type of biometric used
    [key: string]: unknown;        // Any other custom metadata
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

Authenticates a user with a registered passkey. Works across all platforms.

```typescript
interface AuthenticateOptions {
  userId?: string;             // Optional: User ID (for targeted authentication)
  rpId?: string;               // Optional: Relying Party ID (auto-detected on web)
  timeout?: number;            // Optional: Timeout in milliseconds
  userVerification?: "required" | "preferred" | "discouraged";
  metadata?: {                 // Optional: Additional metadata to update
    lastLocation?: string;     // Context where authentication occurred
    appVersion?: string;       // App version
    [key: string]: unknown;        // Any other custom metadata
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

Retrieve all registered passkeys for a user.

**⚠️ Authentication Required**: User must be authenticated before calling this function.

```typescript
interface ListPasskeysOptions {
  userId: string;          // Required: User ID to list passkeys for
  limit?: number;          // Optional: Maximum number of passkeys to return
  offset?: number;         // Optional: Offset for pagination
}

interface ListPasskeysResult {
  data: {
    passkeys: Array<{
      id: string;
      userId: string;
      credentialId: string;
      platform: string;
      lastUsed: string;
      status: "active" | "revoked";
      createdAt: string;
      metadata: Record<string, unknown>;
    }>;
    nextOffset?: number;
  } | null;
  error: Error | null;
}
```

#### `revokePasskey(options): Promise<RevokePasskeyResult>`

Revoke a passkey, preventing it from being used for authentication.

**⚠️ Authentication Required**: User must be authenticated before calling this function. The server validates ownership from the active session.

**🔐 Security Note**: As of v0.3.0, userId is no longer accepted from the client for security. The server validates that the user owns the passkey being revoked.

```typescript
interface RevokePasskeyOptions {
  credentialId: string;    // Required: Credential ID to revoke
  reason?: string;         // Optional: Reason for revocation
}

interface RevokePasskeyResult {
  data: { success: boolean } | null;
  error: Error | null;
}
```

**Example:**
```typescript
// Revoke a passkey
const result = await revokePasskey({
  credentialId: "credential-id-123",
  reason: "User requested removal"
});

if (result.data?.success) {
  console.log("Passkey revoked successfully");
}
```

#### Platform Detection Functions

```typescript
// Check if passkeys are supported on current platform
const isSupported = await isPasskeySupported();

// Get platform-specific device information (mobile only)
if (Platform.OS !== 'web') {
  const deviceInfo = await getDeviceInfo();
  const biometricInfo = await getBiometricInfo();
}

// Check platform authenticator availability (web only)
if (Platform.OS === 'web') {
  const isAvailable = await isPlatformAuthenticatorAvailable();
}
```


## Cross-Platform Usage

### Separate Frontend Applications

For projects with separate mobile and web frontends that share the same backend, both applications can use the `expoPasskeyClient()` plugin:

**Mobile App Example**:
```typescript
// Mobile app (React Native/Expo)
const { data, error } = await registerPasskey({
  userId: "user123",
  userName: "john@example.com",
  displayName: "John Doe",
  rpId: "example.com",
  rpName: "My App"
});

if (data) {
  console.log("Passkey registered on mobile!");
}
```

**Web App Example**:
```typescript
// Web app (Next.js/React)
const { data, error } = await registerPasskey({
  userId: "user123",
  userName: "john@example.com", 
  displayName: "John Doe",
  rpId: "example.com",
  rpName: "My App"
});

if (data) {
  console.log("Passkey registered on web!");
}
```

### Cross-Platform Passkey Syncing

The plugin automatically supports cross-platform credential usage:

#### **iCloud Keychain Flow**
```typescript
// 1. User registers on iPhone (native app)
await registerPasskey({
  userId: "user123",
  userName: "john@example.com",
  authenticatorSelection: {
    authenticatorAttachment: "platform",  // Uses Face ID/Touch ID
    userVerification: "required"
  }
  // Automatically syncs to iCloud Keychain
});

// 2. User opens web app on Mac (same iCloud account)
await authenticateWithPasskey({
  // No userId needed - discovers credentials automatically
  // Can access same passkey from iCloud Keychain
});
```

#### **Hardware Key Flow**
```typescript
// 1. Register YubiKey on mobile
await registerPasskey({
  userId: "user123",
  userName: "john@example.com",
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform", // YubiKey/Security key
    userVerification: "preferred"
  }
});

// 2. Use same YubiKey on web
await authenticateWithPasskey({
  userId: "user123", // Optional - can discover automatically
  // Same YubiKey works across platforms
});
```

### Platform-Specific Features

You can check the current platform and access platform-specific features:

```typescript
import { Platform } from 'react-native';

// Mobile-specific features
if (Platform.OS !== 'web') {
  const biometricInfo = await getBiometricInfo();
  const deviceInfo = await getDeviceInfo();
}

// Web-specific features
if (Platform.OS === 'web') {
  const isAvailable = await isPlatformAuthenticatorAvailable();
}
```

### Unified Passkey Management

With the unified table structure, passkeys work seamlessly across platforms:

- A user can register a passkey on mobile and use it with iCloud Keychain on web
- Security keys work across all platforms  
- The same API manages passkeys regardless of where they were created
- Single database table handles all platform variations
- Enhanced metadata tracks cross-platform usage and original platform

## Client Preferences

### Security Level Control

Control the security requirements for your passkeys:

#### **High Security (Enterprise)**
```typescript
await registerPasskey({
  userId: "executive123",
  userName: "ceo@company.com",
  displayName: "CEO",
  
  // High security preferences
  attestation: "direct",        // Request device attestation for verification
  authenticatorSelection: {
    authenticatorAttachment: "platform",    // Require biometric authenticator
    userVerification: "required",           // Always require biometric verification
    residentKey: "required",               // Create discoverable credentials
  },
  timeout: 120000,             // 2 minutes for complex security flows
});
```

#### **Convenient (Consumer)**
```typescript
await registerPasskey({
  userId: "user123",
  userName: "user@example.com",
  
  // Convenient preferences
  attestation: "none",         // No attestation needed
  authenticatorSelection: {
    authenticatorAttachment: "platform",    // Prefer platform but allow cross-platform
    userVerification: "preferred",          // Prefer but don't require
    residentKey: "preferred",              // Prefer discoverable but allow non-discoverable
  },
  timeout: 60000,             // 1 minute
});
```

#### **Cross-Platform (Hardware Keys)**
```typescript
await registerPasskey({
  userId: "user123",
  userName: "user@example.com",
  
  // Cross-platform preferences
  attestation: "indirect",     // Some attestation for verification
  authenticatorSelection: {
    authenticatorAttachment: "cross-platform", // Allow hardware keys
    userVerification: "required",              // Still require verification
    residentKey: "discouraged",               // Hardware keys often don't support resident keys
  },
});
```

### Adaptive Security

Automatically adjust security based on device capabilities:

```typescript
// Check device capabilities first
const deviceInfo = await getDeviceInfo();
const biometricInfo = await getBiometricInfo();

// Adapt preferences based on device
let preferences = {
  attestation: "none" as const,
  authenticatorSelection: {
    authenticatorAttachment: "platform" as const,
    userVerification: "preferred" as const,
    residentKey: "preferred" as const,
  }
};

// High-end devices get stricter requirements
if (biometricInfo?.isEnrolled && deviceInfo.platform === 'ios') {
  preferences.authenticatorSelection.userVerification = "required";
  preferences.authenticatorSelection.residentKey = "required";
}

// Enterprise environments might require attestation
if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'enterprise') {
  preferences.attestation = "direct";
}

await registerPasskey({
  userId: "user123",
  userName: "user@example.com",
  ...preferences,
});
```

## Database Schema

The plugin uses a unified table structure that works seamlessly across all platforms.

### authPasskey Table

| **Field Name**    | **Type**                | **Key** | **Description**                                      |
|-------------------|-------------------------|---------|------------------------------------------------------|
| `id`              | `string`                | PK      | Unique identifier for each passkey                   |
| `userId`          | `string`                | FK      | The ID of the user (references `user.id`)            |
| `credentialId`    | `string`                | UQ      | Unique identifier of the generated credential        |
| `publicKey`       | `string`                | -       | Base64 encoded public key                            |
| `counter`         | `number`                | -       | For WebAuthn signature verification                  |
| `platform`        | `string`                | -       | Platform on which the passkey is registered          |
| `lastUsed`        | `string`                | -       | Time the passkey was last used                       |
| `status`          | `string`                | -       | Status of the passkey (active/revoked)               |
| `createdAt`       | `string`                | -       | Time when the passkey was created                    |
| `updatedAt`       | `string`                | -       | Time when the passkey was last updated               |
| `revokedAt`       | `string` (optional)     | -       | Timestamp when the passkey was revoked (if any)      |
| `revokedReason`   | `string` (optional)     | -       | Reason for revocation (if any)                       |
| `metadata`        | `string` (JSON)         | -       | JSON string containing metadata about the device and client preferences |
| `aaguid`          | `string`                | -       | Authenticator Attestation Globally Unique Identifier |

### passkeyChallenge Table

| **Field Name**        | **Type**                | **Key** | **Description**                                      |
|-----------------------|-------------------------|---------|------------------------------------------------------|
| `id`                  | `string`                | PK      | Unique identifier for each challenge                 |
| `userId`              | `string`                | -       | The ID of the user                                   |
| `challenge`           | `string`                | -       | Base64url encoded challenge                          |
| `type`                | `string`                | -       | Type of challenge (registration/authentication)      |
| `createdAt`           | `string`                | -       | Time when the challenge was created                  |
| `expiresAt`           | `string`                | -       | Time when the challenge expires                      |
| `registrationOptions` | `string` (optional)     | -       | JSON string containing client registration preferences |

## Custom Schema Configuration

You can customize the database table names to fit your existing database structure or naming conventions:

### Basic Configuration

```typescript
import { betterAuth } from "better-auth";
import { expoPasskey } from "expo-passkey/server";

export const auth = betterAuth({
  plugins: [
    expoPasskey({
      rpId: "example.com",
      rpName: "Your App Name",
      // ✨ Custom schema configuration
      schema: {
        authPasskey: {
          modelName: "user_passkeys" // Custom table name for passkeys
        },
        passkeyChallenge: {
          modelName: "auth_challenges" // Custom table name for challenges
        }
      }
    })
  ]
});
```
### Default Table Names

If no custom schema is provided, the plugin uses these default table names:

- **Passkeys**: `authPasskey`
- **Challenges**: `passkeyChallenge`


## Database Optimizations

Optimizing database performance is essential to get the best out of the Expo Passkey plugin.

### Recommended Fields to Index

- **Single field indexes**:
  - `userId`: For fast lookups of a user's passkeys.
  - `lastUsed`: For efficient sorting and cleanup operations.
  - `status`: For filtering by active/revoked status.
  - `credentialId`: For quick credential lookup during authentication.

- **Compound indexes**:
  - `(credentialId, status)`: Optimizes the authentication endpoint.
  - `(userId, status)`: Accelerates the passkey listing endpoint.
  - `(lastUsed, status)`: Improves performance of cleanup operations.
  - `(userId, type)`: Improves challenge lookup performance.

## Troubleshooting

### Web Issues

- **HTTPS Required**: WebAuthn only works over HTTPS in production
- **Browser Support**: Ensure the browser supports WebAuthn and platform authenticators
- **Same-Origin Policy**: Ensure your RP ID matches your domain
- **Platform Authenticator**: Some browsers may not have platform authenticators available

### iOS Issues

- **iOS Version Requirements**: Must be running iOS 16+ for passkey support
- **Biometric Setup**: Ensure Face ID/Touch ID is configured in device settings
- **Associated Domains**: Verify your apple-app-site-association file is accessible
- **App Configuration**: Check that associatedDomains is properly set in app.json
- **Simulator Limitations**: Biometric authentication in simulators requires additional setup:
  - In the simulator, go to Features → Face ID/Touch ID → Enrolled
  - When prompted, select "Matching Face/Fingerprint" for success testing

### Android Issues

- **API Level**: Must be running Android 10+ (API level 29+)
- **Biometric Hardware**: Device must have fingerprint or facial recognition hardware
- **Asset Links**: Ensure your assetlinks.json file is accessible and correctly formatted
- **Signing Certificates**: Make sure you're using the correct SHA-256 fingerprint
- **Origin Format**: Verify your android:apk-key-hash format in the server config

### Universal App Issues

- **Platform Detection**: The plugin automatically detects the platform, but you can manually check using `Platform.OS`
- **Import Issues**: The plugin uses platform-specific entry points to avoid importing incompatible modules
- **Metro Bundler**: Ensure your Metro configuration supports the export conditions in package.json

### Client Preference Issues

- **Preference Enforcement**: If client preferences aren't being respected, check server logs for stored registration options
- **Attestation Requirements**: Direct attestation may not be available on all devices or platforms
- **Hardware Key Support**: Some authenticator selection criteria may not apply to hardware keys


## Security Considerations

### Session-Based Validation (v0.3.0+)

**Critical Security Enhancement**: The plugin now validates userId from the authenticated session instead of accepting it from client requests. This prevents account takeover attacks where malicious clients could register passkeys for other users.

- **Registration**: Requires active session. Server extracts userId from session token, not client request.
- **Revocation**: Requires active session. Server validates ownership before allowing revocation.
- **Authentication**: Does not require session (users authenticate to create a session).

**Migration from v0.2.x**:
```typescript
// Before v0.3.0 (VULNERABLE - don't use)
await revokePasskey({ userId: "user-123", credentialId: "cred-123" });

// After v0.3.0 (SECURE)
await revokePasskey({ credentialId: "cred-123" });
// userId is automatically validated from the session
```

### Additional Security Measures

- **Client Preference Enforcement**: Server enforces client-specified security requirements
- **Cross-Platform Security**: Passkeys maintain the same security properties across platforms
- **Domain Verification**: Ensure proper domain verification for both web and mobile
- **Relying Party ID**: Configure `rpId` correctly to prevent cross-domain attacks
- **Portable Passkeys**: iCloud Keychain and Google Password Manager sync passkeys securely
- **Hardware Keys**: Support for hardware security keys across all platforms
- **Attestation Handling**: Proper support for enterprise attestation requirements
- **Token Security**: Use HTTPS for all API communications
- **Rate Limiting**: Configure appropriate rate limits to prevent brute force attacks

## Error Handling

The package provides comprehensive error codes for all platforms:

```typescript
// Platform-agnostic error handling with preference validation
try {
  const result = await registerPasskey({
    userId: "user123",
    userName: "user@example.com",
    attestation: "direct",
    authenticatorSelection: {
      userVerification: "required"
    }
  });
  
  if (result.error) {
    if (result.error.code === ERROR_CODES.WEBAUTHN.NOT_SUPPORTED) {
      showPlatformNotSupportedMessage();
    } else if (result.error.code === ERROR_CODES.BIOMETRIC.AUTHENTICATION_FAILED) {
      showAuthFailedMessage();
    } else if (result.error.code === ERROR_CODES.SERVER.VERIFICATION_FAILED) {
      showPreferenceValidationError();
    }
    return;
  }
  
  handleSuccessfulRegistration(result.data);
} catch (error) {
  console.error("Unexpected error:", error);
}
```

## License

MIT

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

- [Better Auth Documentation](https://www.better-auth.com/docs/integrations/expo)
- [Expo Local Authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)
- [WebAuthn Guide](https://webauthn.guide/)
- [SimpleWebAuthn](https://simplewebauthn.dev/)
- [Apple Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- [Android Asset Links](https://developers.google.com/digital-asset-links)
- [Neb Starter Example Project](https://github.com/iosazee/neb-starter)