/**
 * @file WebAuthn specific type definitions
 * @module expo-passkey/types/webauthn
 */

/**
 * WebAuthn authenticator attachment types
 */
export type AuthenticatorAttachment = "platform" | "cross-platform";

/**
 * WebAuthn attestation conveyance preference
 */
export type AttestationConveyancePreference =
  | "none"
  | "indirect"
  | "direct"
  | "enterprise";

/**
 * WebAuthn user verification requirement
 */
export type UserVerificationRequirement =
  | "required"
  | "preferred"
  | "discouraged";

/**
 * WebAuthn authenticator selection criteria
 */
export interface AuthenticatorSelectionCriteria {
  authenticatorAttachment?: AuthenticatorAttachment;
  residentKey?: "required" | "preferred" | "discouraged";
  requireResidentKey?: boolean;
  userVerification?: UserVerificationRequirement;
}

/**
 * PublicKeyCredentialRpEntity - Relying Party entity
 */
export interface PublicKeyCredentialRpEntity {
  id: string;
  name: string;
}

/**
 * PublicKeyCredentialUserEntity - User entity
 */
export interface PublicKeyCredentialUserEntity {
  id: string; // base64url encoded
  name: string;
  displayName: string;
}

/**
 * WebAuthn PublicKeyCredentialParameters
 */
export interface PublicKeyCredentialParameters {
  type: "public-key";
  alg: number; // COSEAlgorithmIdentifier
}

/**
 * WebAuthn credential creation options for registration
 */
export interface PublicKeyCredentialCreationOptions {
  rp: PublicKeyCredentialRpEntity;
  user: PublicKeyCredentialUserEntity;
  challenge: string; // base64url encoded
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptor[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  extensions?: Record<string, unknown>;
}

/**
 * WebAuthn PublicKeyCredentialDescriptor
 */
export interface PublicKeyCredentialDescriptor {
  type: "public-key";
  id: string; // base64url encoded
  transports?: string[];
}

/**
 * WebAuthn credential request options for authentication
 */
export interface PublicKeyCredentialRequestOptions {
  challenge: string; // base64url encoded
  rpId: string;
  allowCredentials?: PublicKeyCredentialDescriptor[];
  userVerification?: UserVerificationRequirement;
  timeout?: number;
  extensions?: Record<string, unknown>;
}

/**
 * WebAuthn client data structure
 */
export interface WebAuthnClientData {
  type: "webauthn.create" | "webauthn.get";
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

/**
 * WebAuthn AuthenticatorAttestationResponse
 */
export interface AuthenticatorAttestationResponse {
  clientDataJSON: string;
  attestationObject: string;
  transports?: string[];
}

/**
 * WebAuthn AuthenticatorAssertionResponse
 */
export interface AuthenticatorAssertionResponse {
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle?: string;
}

/**
 * WebAuthn PublicKeyCredential for registration
 */
export interface RegistrationPublicKeyCredential {
  id: string;
  rawId: string;
  type: "public-key";
  response: AuthenticatorAttestationResponse;
  clientExtensionResults?: Record<string, unknown>;
  authenticatorAttachment?: AuthenticatorAttachment;
}

/**
 * WebAuthn PublicKeyCredential for authentication
 */
export interface AuthenticationPublicKeyCredential {
  id: string;
  rawId: string;
  type: "public-key";
  response: AuthenticatorAssertionResponse;
  clientExtensionResults?: Record<string, unknown>;
}
