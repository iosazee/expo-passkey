# WebAuthn Implementation in Expo Passkey

This document provides details about the WebAuthn standard implementation in the Expo Passkey package.

## Overview

[WebAuthn](https://www.w3.org/TR/webauthn-2/) (Web Authentication) is a web standard published by the World Wide Web Consortium (W3C) that allows websites to register and authenticate users using public key cryptography instead of passwords. 

The Expo Passkey package implements this standard to provide secure, passwordless authentication on mobile devices by leveraging the native biometric capabilities of iOS and Android.

## Platform-specific Implementations

### iOS Implementation

For iOS, this package utilizes Apple's PassKeys system through the following APIs:

- `ASAuthorizationPlatformPublicKeyCredentialProvider` for platform authenticators (Face ID, Touch ID)
- `ASAuthorizationSecurityKeyPublicKeyCredentialProvider` for cross-platform authenticators (security keys)

Key features of the iOS implementation:

- Full support for iOS 16+ where native PassKeys are available
- Support for both platform authenticators (biometrics) and security keys
- Proper attestation and assertion handling for authentication
- Integration with Apple's authentication UI
- Extraction of public keys from attestation objects for verification

### Android Implementation

For Android, this package utilizes the AndroidX Credentials API:

- `CredentialManager` with `CreatePublicKeyCredentialRequest` for registration
- `GetPublicKeyCredentialOption` for authentication

Key features of the Android implementation:

- Support for Android 10+ (API level 29+)
- Integration with the Android Credentials API
- Proper error handling and translation to WebAuthn standard errors
- Support for both platform and cross-platform authenticators
- Thread management for credential operations

## WebAuthn Flow Implementation

### Registration Flow

1. **Challenge Generation**: The server generates a random challenge and creates WebAuthn registration options.
2. **Client Processing**: The client receives these options and passes them to the native APIs.
3. **User Authentication**: The device prompts the user for biometric verification.
4. **Credential Creation**: Upon successful authentication, a new passkey credential is created.
5. **Attestation**: The credential includes an attestation object that proves it was generated on a legitimate device.
6. **Response Validation**: The server validates the attestation response and registers the credential.

### Authentication Flow

1. **Challenge Generation**: The server generates a random challenge and creates WebAuthn authentication options.
2. **Client Processing**: The client receives these options and passes them to the native APIs.
3. **Credential Selection**: The device helps the user select a credential (or uses the one specified).
4. **User Verification**: The device prompts the user for biometric verification.
5. **Assertion Creation**: Upon successful verification, an assertion is created and signed with the credential's private key.
6. **Response Validation**: The server validates the assertion against the stored public key.

## Security Considerations

- **Key Storage**: Private keys are securely stored in the device's hardware security module or secure enclave.
- **Biometric Protection**: Access to private keys requires biometric verification.
- **Challenge-Response**: All operations use server-generated challenges to prevent replay attacks.
- **Origin Binding**: Credentials are bound to specific relying party IDs to prevent phishing.
- **Device Binding**: Credentials are bound to specific devices, preventing credential theft.

## WebAuthn Data Structures

The implementation uses standard WebAuthn data structures as defined in the specification:

- `PublicKeyCredentialCreationOptions` for registration
- `PublicKeyCredentialRequestOptions` for authentication
- `AuthenticatorAttestationResponse` for registration responses
- `AuthenticatorAssertionResponse` for authentication responses

## Future Improvements

- Enhanced support for cross-platform authenticators
- FIDO2 certification compliance
- Support for enterprise attestation requirements
- Passkey synchronization across devices (where applicable)
- WebAuthn Level 3 features as they become available

## References

- [W3C WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [Apple PassKeys Documentation](https://developer.apple.com/documentation/authenticationservices/public-private_key_authentication/supporting_passkeys/)
- [Android Credential Manager Documentation](https://developer.android.com/training/sign-in/passkeys)
- [FIDO2 WebAuthn](https://fidoalliance.org/fido2/fido2-web-authentication-webauthn/)
- [WebAuthn Guide](https://webauthn.guide/)