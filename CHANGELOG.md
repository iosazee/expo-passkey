# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.6] - 2025-10-23

### 🐛 Bug Fixes

**CRITICAL**: Fixed authentication challenge endpoint failing with `401 Unauthorized` for unauthenticated users. Implemented conditional middleware that enforces session requirement only for registration challenges while allowing authentication challenges without session.

---

## [0.3.4] - 2025-10-22

### 🐛 Bug Fixes

**CRITICAL**: Fixed passkey registration regression introduced in v0.3.0 where challenge endpoint failed with `401 SESSION_REQUIRED` error despite valid session cookies. Added missing `sessionMiddleware` to properly validate authenticated sessions.

---

## [0.3.0] - 2025-10-17

### 🔒 Security

**CRITICAL**: Fixed account takeover vulnerability. Server now validates `userId` from authenticated session instead of accepting it from client requests.

### ⚠️ Breaking Changes

- `revokePasskey()` no longer accepts `userId` parameter
- Registration and revocation require authenticated sessions
- Endpoints return 401 if session is missing

### Migration

```typescript
// Before
await revokePasskey({ userId: "user-123", credentialId: "cred-123" });

// After
await revokePasskey({ credentialId: "cred-123" });
```

Users must authenticate before registering passkeys. `registerPasskey()` API unchanged.

### Changes

- Add session middleware to register/revoke endpoints
- Remove userId from client request schemas
- Update documentation with authentication requirements
- Update all tests with session mocks

---

## [0.2.0] - 2025-06-25

### 🎉 Major Features

#### **Web Platform Support**
- **NEW**: Full WebAuthn support for web browsers using `@simplewebauthn/browser`
- **NEW**: Platform-specific entry points: `expo-passkey/native`, `expo-passkey/web`, `expo-passkey/server`
- **NEW**: Web-specific utilities and error handling
- **NEW**: `isPlatformAuthenticatorAvailable()` function for web environments
- **NEW**: Automatic platform detection and appropriate WebAuthn implementation

#### **Cross-Platform Passkey Portability**
- **NEW**: Unified `authPasskey` table structure supporting all platforms
- **NEW**: Automatic support for iCloud Keychain credential syncing across Apple devices
- **NEW**: Support for Google Password Manager credential syncing
- **NEW**: Hardware security key support across all platforms (YubiKey, etc.)
- **NEW**: Cross-platform credential discovery and usage
- **NEW**: Enhanced metadata tracking original platform and cross-platform usage

#### **Client-Controlled WebAuthn Preferences**
- **NEW**: Full client control over WebAuthn attestation preferences (`none`, `indirect`, `direct`, `enterprise`)
- **NEW**: Authenticator selection criteria configuration:
  - `authenticatorAttachment`: `platform` vs `cross-platform`
  - `userVerification`: `required`, `preferred`, `discouraged`
  - `residentKey`: `required`, `preferred`, `discouraged`
  - `requireResidentKey`: boolean flag
- **NEW**: Timeout configuration per operation
- **NEW**: Server-side enforcement of client preferences
- **NEW**: Registration options stored and validated on server

### 🔧 API Enhancements

#### **Client API**
- **ENHANCED**: `registerPasskey()` now accepts comprehensive WebAuthn preferences
- **ENHANCED**: `authenticateWithPasskey()` supports user verification preferences
- **NEW**: Platform-specific feature detection functions
- **NEW**: Adaptive security configuration based on device capabilities
- **ENHANCED**: Rich metadata support with client preference tracking
- **NEW**: Automatic credential synchronization across platforms

#### **Server API**
- **ENHANCED**: Challenge endpoint now stores registration options for client preferences
- **ENHANCED**: Registration endpoint validates and enforces client preferences
- **ENHANCED**: Authentication endpoint supports user verification requirements
- **NEW**: Enhanced logging with client preference information
- **NEW**: Improved error handling for preference validation

### 🗃️ Database Changes

#### **Schema Updates**
- **BREAKING**: Table renamed from `mobilePasskey` to `authPasskey` for platform neutrality
- **NEW**: `registrationOptions` field in `passkeyChallenge` table for client preferences
- **ENHANCED**: `metadata` field now includes client preference tracking
- **ENHANCED**: Enhanced indexes for improved query performance

#### **Migration Support**
- **NEW**: Automatic migration support for v0.1.x users
- **NEW**: Database migration scripts and guidance
- **NEW**: Backward compatibility considerations

### 🚀 Developer Experience

#### **Import Strategy**
- **NEW**: Platform-specific imports to prevent conflicts:
  ```typescript
  import { expoPasskeyClient } from "expo-passkey/native";  // Mobile
  import { expoPasskeyClient } from "expo-passkey/web";     // Web
  import { expoPasskey } from "expo-passkey/server";        // Server
  ```
- **NEW**: Guard rail on main entry point with helpful error messages
- **NEW**: Improved TypeScript definitions for all platforms

#### **Documentation & Examples**
- **NEW**: Comprehensive cross-platform usage examples
- **NEW**: Client preference configuration guides
- **NEW**: Security level templates (Enterprise, Consumer, Cross-Platform)
- **NEW**: Adaptive security implementation patterns
- **NEW**: Migration guide from v0.1.x
- **NEW**: Enhanced troubleshooting for all platforms

### 🔒 Security Enhancements

#### **Enterprise Features**
- **NEW**: Direct attestation support for enterprise environments
- **NEW**: Required user verification enforcement
- **NEW**: Discoverable credential requirements
- **NEW**: Enhanced audit logging with client preferences

#### **Cross-Platform Security**
- **NEW**: Consistent security properties across all platforms
- **NEW**: Platform-specific origin validation
- **NEW**: Enhanced domain verification for web and mobile
- **NEW**: Secure credential metadata handling

### 🐛 Bug Fixes

- **FIXED**: Improved error handling for WebAuthn operations
- **FIXED**: Better platform detection and capability checking
- **FIXED**: Enhanced biometric availability detection
- **FIXED**: Improved credential storage synchronization
- **FIXED**: Better handling of expired challenges
- **FIXED**: Enhanced cleanup job error handling

### 📱 Platform Support

#### **Web Browsers**
- **NEW**: Chrome 67+ with WebAuthn support
- **NEW**: Firefox 60+ with WebAuthn support  
- **NEW**: Safari 14+ with WebAuthn support
- **NEW**: Edge 79+ with WebAuthn support
- **REQUIREMENT**: HTTPS required in production

#### **Mobile Platforms**
- **MAINTAINED**: iOS 16+ support
- **MAINTAINED**: Android 10+ (API level 29+) support
- **ENHANCED**: Improved biometric capability detection
- **ENHANCED**: Better error messages for unsupported devices

### 🔄 Dependencies

#### **New Dependencies**
- **ADDED**: `@simplewebauthn/browser` for web WebAuthn support
- **PEER**: All existing Expo dependencies remain the same

#### **Updated Dependencies**
- **UPDATED**: Enhanced TypeScript definitions
- **MAINTAINED**: Compatibility with Better Auth ecosystem
- **MAINTAINED**: All existing peer dependencies

### ⚡ Performance Improvements

- **IMPROVED**: Faster credential lookup with enhanced database indexes
- **IMPROVED**: Optimized challenge generation and validation
- **IMPROVED**: Better memory usage in web environments
- **IMPROVED**: Reduced bundle size through platform-specific imports
- **IMPROVED**: Enhanced cleanup job performance

### 🎬 Demos & Resources

- **NEW**: Cross-platform portability demo showing mobile-to-web passkey usage
- **UPDATED**: Enhanced iOS and Android demo videos
- **NEW**: Web browser demonstration examples
- **ENHANCED**: Real-world usage examples in documentation

### 📋 Breaking Changes

1. **Database Schema**: Table renamed from `mobilePasskey` to `authPasskey`
2. **Import Paths**: Must use platform-specific imports (`/native`, `/web`, `/server`)
3. **API Changes**: Some function signatures enhanced with new optional parameters
4. **Dependencies**: New peer dependency on `@simplewebauthn/browser` for web support

### 🔧 Migration Guide

For detailed migration instructions from v0.1.x, see the [Migration Guide](README.md#migration-from-v01x) in the README.

### 📊 Testing & Quality

- **ENHANCED**: Comprehensive test suite covering all platforms
- **NEW**: Web-specific test coverage
- **NEW**: Cross-platform integration tests
- **NEW**: Client preference validation tests
- **IMPROVED**: Better error scenario coverage

---

## [0.1.0] - 2024-XX-XX

### Initial Release

- Initial implementation of passkey authentication for Expo apps
- iOS and Android platform support
- Better Auth integration
- Basic WebAuthn-inspired implementation
- Native biometric authentication support
- Secure credential storage
- Comprehensive TypeScript definitions

---

**Note**: This changelog follows [Keep a Changelog](https://keepachangelog.com/) format. For the complete list of changes and technical details, please refer to the [GitHub releases](https://github.com/iosazee/expo-passkey/releases).