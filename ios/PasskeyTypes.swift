import ExpoModulesCore
import AuthenticationServices

// MARK: - Base64URL Helper Extension

// Base64URL encoding/decoding for Data
extension Data {
  func toBase64URLEncodedString() -> String {
    var result = self.base64EncodedString()
    result = result.replacingOccurrences(of: "+", with: "-")
    result = result.replacingOccurrences(of: "/", with: "_")
    result = result.replacingOccurrences(of: "=", with: "")
    return result
  }
  
  init?(base64URLEncoded input: String) {
    var base64 = input
    base64 = base64.replacingOccurrences(of: "-", with: "+")
    base64 = base64.replacingOccurrences(of: "_", with: "/")
    
    // Add padding if needed
    let remainder = base64.count % 4
    if remainder > 0 {
      base64 = base64.padding(toLength: base64.count + 4 - remainder, withPad: "=", startingAt: 0)
    }
    
    self.init(base64Encoded: base64)
  }
}

// MARK: - Type Definitions

// Branded type to improve code readability
typealias Base64URLString = String

// Registration response JSON format
struct RegistrationResponseJSON: Record {
  @Field
  var id: Base64URLString
  
  @Field
  var rawId: Base64URLString
  
  @Field
  var response: AuthenticatorAttestationResponseJSON
  
  @Field
  var authenticatorAttachment: String?
  
  @Field
  var clientExtensionResults: AuthenticationExtensionsClientOutputsJSON?
  
  @Field
  var type: String = "public-key"
}

// Authentication response JSON format
struct AuthenticationResponseJSON: Record {
  @Field
  var id: Base64URLString
  
  @Field
  var rawId: Base64URLString
  
  @Field
  var response: AuthenticatorAssertionResponseJSON
  
  @Field
  var authenticatorAttachment: String?
  
  @Field
  var clientExtensionResults: AuthenticationExtensionsClientOutputsJSON?
  
  @Field
  var type: String = "public-key"
}

// Attestation response format
struct AuthenticatorAttestationResponseJSON: Record {
  @Field
  var clientDataJSON: Base64URLString
  
  @Field
  var publicKey: Base64URLString?
  
  @Field
  var publicKeyAlgorithm: Int?
  
  @Field
  var transports: [String]?
  
  @Field
  var attestationObject: Base64URLString
}

// Assertion response format
struct AuthenticatorAssertionResponseJSON: Record {
  @Field
  var authenticatorData: Base64URLString
  
  @Field
  var clientDataJSON: Base64URLString
  
  @Field
  var signature: Base64URLString
  
  @Field
  var userHandle: Base64URLString?
}

// Extensions client outputs
struct AuthenticationExtensionsClientOutputsJSON: Record {
  @Field
  var largeBlob: AuthenticationExtensionsLargeBlobOutputsJSON?
}

// Large blob extension outputs
struct AuthenticationExtensionsLargeBlobOutputsJSON: Record {
  @Field
  var supported: Bool?
  
  @Field
  var blob: Base64URLString?
  
  @Field
  var written: Bool?
}

// MARK: - WebAuthn Request Input Types

// WebAuthn Registration Options
struct PublicKeyCredentialCreationOptions: Decodable {
  let rp: RelyingParty
  let user: User
  let challenge: String
  let pubKeyCredParams: [PublicKeyCredentialParameters]?
  let timeout: Int?
  let excludeCredentials: [PublicKeyCredentialDescriptor]?
  let authenticatorSelection: AuthenticatorSelectionCriteria?
  let attestation: String?
  let extensions: AuthenticationExtensionsClientInputs?
  
  struct RelyingParty: Decodable {
    let id: String
    let name: String
  }
  
  struct User: Decodable {
    let id: String
    let name: String
    let displayName: String
  }
}

// WebAuthn Authentication Options
struct PublicKeyCredentialRequestOptions: Decodable {
  let challenge: String
  let rpId: String
  let timeout: Int?
  let allowCredentials: [PublicKeyCredentialDescriptor]?
  let userVerification: String?
  let extensions: AuthenticationExtensionsClientInputs?
}

// WebAuthn Public Key Credential Parameters
struct PublicKeyCredentialParameters: Decodable {
  let type: String
  let alg: Int
}

// WebAuthn Public Key Credential Descriptor
struct PublicKeyCredentialDescriptor: Decodable {
  let type: String
  let id: String
  let transports: [String]?
}

// WebAuthn Authenticator Selection Criteria
struct AuthenticatorSelectionCriteria: Decodable {
  let authenticatorAttachment: String?
  let requireResidentKey: Bool?
  let residentKey: String?
  let userVerification: String?
}

// WebAuthn Extension Inputs
struct AuthenticationExtensionsClientInputs: Decodable {
  let largeBlob: LargeBlobExtensionInputs?
  
  struct LargeBlobExtensionInputs: Decodable {
    let support: String?
    let read: Bool?
    let write: String?
  }
}