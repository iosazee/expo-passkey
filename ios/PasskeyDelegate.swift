import AuthenticationServices
import ExpoModulesCore
import LocalAuthentication

protocol PasskeyResultHandler {
  func onSuccess(_ data: Any)
  func onFailure(_ error: Error)
}

@available(iOS 15.0, *)
class PasskeyDelegate: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  private let handler: PasskeyResultHandler
  var promise: Promise?
  
  init(handler: PasskeyResultHandler) {
    self.handler = handler
    super.init()
  }
  
  // Perform the authorization request for a given ASAuthorizationController instance
  func performAuthForController(controller: ASAuthorizationController) {
    controller.delegate = self
    controller.presentationContextProvider = self
    controller.performRequests()
  }
  
  // Provide window for authentication UI
  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes
    let windowScene = scenes.first as? UIWindowScene
    guard let window = windowScene?.windows.first else {
      return ASPresentationAnchor()
    }
    return window
  }
  
  // Handle authorization errors
  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithError error: Error
  ) {
    handler.onFailure(error)
  }
  
  // Handle successful authorization
  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    switch authorization.credential {
    case let credential as ASAuthorizationPlatformPublicKeyCredentialRegistration:
      handlePlatformPublicKeyRegistrationResponse(credential: credential)
      
    case let credential as ASAuthorizationSecurityKeyPublicKeyCredentialRegistration:
      handleSecurityKeyPublicKeyRegistrationResponse(credential: credential)
      
    case let credential as ASAuthorizationPlatformPublicKeyCredentialAssertion:
      handlePlatformPublicKeyAssertionResponse(credential: credential)
      
    case let credential as ASAuthorizationSecurityKeyPublicKeyCredentialAssertion:
      handleSecurityKeyPublicKeyAssertionResponse(credential: credential)
      
    default:
      handler.onFailure(ASAuthorizationError(.invalidResponse))
    }
  }
  
  // Handle platform key registration
  private func handlePlatformPublicKeyRegistrationResponse(credential: ASAuthorizationPlatformPublicKeyCredentialRegistration) {
    guard let attestationObject = credential.rawAttestationObject else {
      handler.onFailure(ASAuthorizationError(.invalidResponse))
      return
    }
    
    // Extract public key
    let publicKey = getPublicKey(from: attestationObject)?.toBase64URLEncodedString()
    
    // Create response with all required fields
    let response = AuthenticatorAttestationResponseJSON()
    response.clientDataJSON = credential.rawClientDataJSON.toBase64URLEncodedString()
    if let publicKey = publicKey {
      response.publicKey = publicKey
    }
    response.attestationObject = attestationObject.toBase64URLEncodedString()
    
    // Create the full registration response
    let registrationResponse = RegistrationResponseJSON()
    registrationResponse.id = credential.credentialID.toBase64URLEncodedString()
    registrationResponse.rawId = credential.credentialID.toBase64URLEncodedString()
    registrationResponse.response = response
    registrationResponse.authenticatorAttachment = "platform"
    registrationResponse.type = "public-key"
    
    handler.onSuccess(registrationResponse)
  }
  
  // Handle security key registration
  private func handleSecurityKeyPublicKeyRegistrationResponse(credential: ASAuthorizationSecurityKeyPublicKeyCredentialRegistration) {
    guard let attestationObject = credential.rawAttestationObject else {
      handler.onFailure(ASAuthorizationError(.invalidResponse))
      return
    }
    
    // Extract public key
    let publicKey = getPublicKey(from: attestationObject)?.toBase64URLEncodedString()
    
    // Create response with all required fields
    let response = AuthenticatorAttestationResponseJSON()
    response.clientDataJSON = credential.rawClientDataJSON.toBase64URLEncodedString()
    if let publicKey = publicKey {
      response.publicKey = publicKey
    }
    response.attestationObject = attestationObject.toBase64URLEncodedString()
    
    // Create the full registration response
    let registrationResponse = RegistrationResponseJSON()
    registrationResponse.id = credential.credentialID.toBase64URLEncodedString()
    registrationResponse.rawId = credential.credentialID.toBase64URLEncodedString()
    registrationResponse.response = response
    registrationResponse.authenticatorAttachment = "cross-platform"
    registrationResponse.type = "public-key"
    
    handler.onSuccess(registrationResponse)
  }
  
  // Handle platform key authentication
  private func handlePlatformPublicKeyAssertionResponse(credential: ASAuthorizationPlatformPublicKeyCredentialAssertion) {
    guard let signature = credential.signature else {
      handler.onFailure(ASAuthorizationError(.invalidResponse))
      return
    }
    
    // Create the assertion response
    let response = AuthenticatorAssertionResponseJSON()
    response.authenticatorData = credential.rawAuthenticatorData.toBase64URLEncodedString()
    response.clientDataJSON = credential.rawClientDataJSON.toBase64URLEncodedString()
    response.signature = signature.toBase64URLEncodedString()
    if let userID = credential.userID {
      response.userHandle = userID.toBase64URLEncodedString()
    }
    
    // Create the full authentication response
    let authResponse = AuthenticationResponseJSON()
    authResponse.id = credential.credentialID.toBase64URLEncodedString()
    authResponse.rawId = credential.credentialID.toBase64URLEncodedString()
    authResponse.response = response
    authResponse.authenticatorAttachment = "platform"
    authResponse.type = "public-key"
    
    handler.onSuccess(authResponse)
  }
  
  // Handle security key authentication
  private func handleSecurityKeyPublicKeyAssertionResponse(credential: ASAuthorizationSecurityKeyPublicKeyCredentialAssertion) {
    guard let signature = credential.signature else {
      handler.onFailure(ASAuthorizationError(.invalidResponse))
      return
    }
    
    // Create the assertion response
    let response = AuthenticatorAssertionResponseJSON()
    response.authenticatorData = credential.rawAuthenticatorData.toBase64URLEncodedString()
    response.clientDataJSON = credential.rawClientDataJSON.toBase64URLEncodedString()
    response.signature = signature.toBase64URLEncodedString()
    if let userID = credential.userID {
      response.userHandle = userID.toBase64URLEncodedString()
    }
    
    // Create the full authentication response
    let authResponse = AuthenticationResponseJSON()
    authResponse.id = credential.credentialID.toBase64URLEncodedString()
    authResponse.rawId = credential.credentialID.toBase64URLEncodedString()
    authResponse.response = response
    authResponse.authenticatorAttachment = "cross-platform"
    authResponse.type = "public-key"
    
    handler.onSuccess(authResponse)
  }
  
  // Extract public key from attestation object
  private func getPublicKey(from attestationObject: Data) -> Data? {
    // Use the CBOR decoder to extract the public key
    return SimpleCBORDecoder.extractPublicKey(from: attestationObject)
  }
}