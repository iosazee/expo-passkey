package expo.modules.passkey

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * WebAuthn credential creation options for registration
 * Specification reference: https://w3c.github.io/webauthn/#dictionary-makecredentialoptions
 */
class PublicKeyCredentialCreationOptions: Record {
    @Field
    var rp: PublicKeyCredentialRpEntity = PublicKeyCredentialRpEntity()

    @Field
    var user: PublicKeyCredentialUserEntity = PublicKeyCredentialUserEntity()

    @Field
    var challenge: String = ""

    @Field
    var pubKeyCredParams: List<PublicKeyCredentialParameters> = listOf()

    @Field
    var timeout: Int? = null

    @Field
    var excludeCredentials: List<PublicKeyCredentialDescriptor>? = null

    @Field
    var authenticatorSelection: AuthenticatorSelectionCriteria? = null

    @Field
    var attestation: String? = null
}

/**
 * WebAuthn credential request options for authentication
 * Specification reference: https://w3c.github.io/webauthn/#dictionary-assertion-options
 */
class PublicKeyCredentialRequestOptions: Record {
    @Field
    var challenge: String = ""

    @Field
    var rpId: String = ""

    @Field
    var timeout: Int? = null

    @Field
    var allowCredentials: List<PublicKeyCredentialDescriptor>? = null

    @Field
    var userVerification: String? = null
}

/**
 * Authenticator selection criteria for WebAuthn registration
 * Specification reference: https://w3c.github.io/webauthn/#dictionary-authenticatorSelection
 */
class AuthenticatorSelectionCriteria: Record {
    @Field
    var authenticatorAttachment: String? = null

    @Field
    var residentKey: String? = null

    @Field
    var requireResidentKey: Boolean? = null

    @Field
    var userVerification: String? = null
}

/**
 * Public key credential parameters
 * Specification reference: https://w3c.github.io/webauthn/#dictionary-credential-params
 */
class PublicKeyCredentialParameters: Record {
    @Field
    var type: String = ""

    @Field
    var alg: Long = 0
}

/**
 * Relying party entity information
 * Specification reference: https://w3c.github.io/webauthn/#dictdef-publickeycredentialrpentity
 */
class PublicKeyCredentialRpEntity: Record {
    @Field
    var name: String = ""

    @Field
    var id: String? = null
}

/**
 * User entity information
 * Specification reference: https://w3c.github.io/webauthn/#dictdef-publickeycredentialuserentity
 */
class PublicKeyCredentialUserEntity: Record {
    @Field
    var name: String = ""

    @Field
    var displayName: String = ""

    @Field
    var id: String = ""
}

/**
 * Public key credential descriptor
 * Specification reference: https://w3c.github.io/webauthn/#dictdef-publickeycredentialdescriptor
 */
class PublicKeyCredentialDescriptor: Record {
    @Field
    var id: String = ""

    @Field
    var transports: List<String>? = null

    @Field
    var type: String = "public-key"
}

/**
 * WebAuthn registration response
 * Represents the response from navigator.credentials.create()
 */
class RegistrationResponseJSON: Record {
    @Field
    var id: String = ""

    @Field
    var rawId: String = ""

    @Field
    var response: AuthenticatorAttestationResponseJSON = AuthenticatorAttestationResponseJSON()

    @Field
    var authenticatorAttachment: String? = null

    @Field
    var clientExtensionResults: AuthenticationExtensionsClientOutputsJSON? = null

    @Field
    var type: String = "public-key"
}

/**
 * WebAuthn authenticator attestation response
 * Specification reference: https://w3c.github.io/webauthn/#dictdef-authenticatorattestationresponsejson
 */
class AuthenticatorAttestationResponseJSON: Record {
    @Field
    var clientDataJSON: String = ""

    @Field
    var authenticatorData: String? = null

    @Field
    var transports: List<String>? = null

    @Field
    var publicKeyAlgorithm: Int? = null

    @Field
    var publicKey: String? = null

    @Field
    var attestationObject: String = ""
}

/**
 * WebAuthn authentication response
 * Represents the response from navigator.credentials.get()
 */
class AuthenticationResponseJSON: Record {
    @Field
    var type: String = "public-key"

    @Field
    var id: String = ""

    @Field
    var rawId: String? = null

    @Field
    var authenticatorAttachment: String? = null

    @Field
    var response: AuthenticatorAssertionResponseJSON = AuthenticatorAssertionResponseJSON()

    @Field
    var clientExtensionResults: AuthenticationExtensionsClientOutputsJSON? = null
}

/**
 * WebAuthn authenticator assertion response
 * Specification reference: https://w3c.github.io/webauthn/#dictdef-authenticatorassertionresponsejson
 */
class AuthenticatorAssertionResponseJSON: Record {
    @Field
    var authenticatorData: String = ""

    @Field
    var clientDataJSON: String = ""

    @Field
    var signature: String = ""

    @Field
    var userHandle: String? = null

    @Field
    var attestationObject: String? = null
}

/**
 * WebAuthn client extension outputs
 */
class AuthenticationExtensionsClientOutputsJSON: Record {
    @Field
    var largeBlob: AuthenticationExtensionsLargeBlobOutputsJSON? = null
}

/**
 * WebAuthn large blob extension outputs
 * Specification reference: https://w3c.github.io/webauthn/#dictdef-authenticationextensionslargebloboutputs
 */
class AuthenticationExtensionsLargeBlobOutputsJSON: Record {
    @Field
    var supported: Boolean? = null

    @Field
    var blob: String? = null

    @Field
    var written: Boolean? = null
}