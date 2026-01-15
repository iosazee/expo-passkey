import ExpoModulesCore
import AuthenticationServices
import LocalAuthentication

public class ExpoPasskeyModule: Module, PasskeyResultHandler {
  private var passkeyDelegate: PasskeyDelegate?
  
  public func definition() -> ModuleDefinition {
    Name("ExpoPasskeyModule")
    
    Function("isPasskeySupported") { () -> Bool in
      if #available(iOS 15.0, *) {
        let context = LAContext()
        return context.biometricType != .none
      } else {
        return false
      }
    }
    
    AsyncFunction("createPasskey") { (options: [String: Any], promise: Promise) in
      do {
        // Check iOS version
        if #unavailable(iOS 15.0) {
          promise.reject(NotSupportedException())
          return
        }
        
        // Validate input
        guard let requestJson = options["requestJson"] as? String else {
          promise.reject(InvalidChallengeException())
          return
        }
        
        // Check if there's already an operation in progress
        if self.passkeyDelegate != nil {
          promise.reject(PendingPasskeyRequestException())
          return
        }
        
        // Check biometric availability
        let context = LAContext()
        if context.biometricType == .none {
          promise.reject(BiometricException())
          return
        }
        
        // Create delegate to handle auth callbacks
        let delegate = PasskeyDelegate(handler: self)
        self.passkeyDelegate = delegate
        delegate.promise = promise
        
        // Create registration requests
        try self.handleCreatePasskey(requestJson: requestJson, delegate: delegate, promise: promise)
      } catch {
        promise.reject(error)
      }
    }
    
    AsyncFunction("authenticateWithPasskey") { (options: [String: Any], promise: Promise) in
      do {
        // Check iOS version
        if #unavailable(iOS 15.0) {
          promise.reject(NotSupportedException())
          return
        }
        
        // Validate input
        guard let requestJson = options["requestJson"] as? String else {
          promise.reject(InvalidChallengeException())
          return
        }
        
        // Check if there's already an operation in progress
        if self.passkeyDelegate != nil {
          promise.reject(PendingPasskeyRequestException())
          return
        }
        
        // Check biometric availability
        let context = LAContext()
        if context.biometricType == .none {
          promise.reject(BiometricException())
          return
        }
        
        // Create delegate to handle auth callbacks
        let delegate = PasskeyDelegate(handler: self)
        self.passkeyDelegate = delegate
        delegate.promise = promise
        
        // Create authentication requests
        try self.handleAuthenticatePasskey(requestJson: requestJson, delegate: delegate, promise: promise)
      } catch {
        promise.reject(error)
      }
    }
  }
  
  @available(iOS 15.0, *)
  private func handleCreatePasskey(requestJson: String, delegate: PasskeyDelegate, promise: Promise) throws {
    guard let requestData = requestJson.data(using: .utf8) else {
      throw InvalidChallengeException()
    }
    
    // Parse request
    let options = try JSONDecoder().decode(PublicKeyCredentialCreationOptions.self, from: requestData)
    
    // Get challenge and user data
    guard let challenge = Data(base64URLEncoded: options.challenge) else {
      throw InvalidChallengeException()
    }
    
    guard let userId = Data(base64URLEncoded: options.user.id) else {
      throw InvalidUserIdException()
    }
    
    // Set up requests based on authenticator attachment preference
    var requests = [ASAuthorizationRequest]()
    
    // Create platform request if requested or if no specific authenticator is specified
    if options.authenticatorSelection?.authenticatorAttachment != "cross-platform" {
      let platformProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rp.id)
      let platformRequest = platformProvider.createCredentialRegistrationRequest(
        challenge: challenge,
        name: options.user.name,
        userID: userId
      )
      
      if let userVerification = options.authenticatorSelection?.userVerification {
        platformRequest.userVerificationPreference = convertUserVerificationPreference(userVerification)
      }
      
      requests.append(platformRequest)
    }
    
    // Create security key request if requested or if no specific authenticator is specified
    if options.authenticatorSelection?.authenticatorAttachment == "cross-platform" || options.authenticatorSelection?.authenticatorAttachment == nil {
      let securityKeyProvider = ASAuthorizationSecurityKeyPublicKeyCredentialProvider(relyingPartyIdentifier: options.rp.id)
      let securityKeyRequest = securityKeyProvider.createCredentialRegistrationRequest(
        challenge: challenge,
        displayName: options.user.displayName,
        name: options.user.name,
        userID: userId
      )
      
      // Configure security key options
      if let algParams = options.pubKeyCredParams {
        securityKeyRequest.credentialParameters = algParams.map { param in
          return ASAuthorizationPublicKeyCredentialParameters(algorithm: ASCOSEAlgorithmIdentifier(rawValue: param.alg))
        }
      }
      
      if let userVerification = options.authenticatorSelection?.userVerification {
        securityKeyRequest.userVerificationPreference = convertUserVerificationPreference(userVerification)
      }
      
      if let attestation = options.attestation {
        securityKeyRequest.attestationPreference = convertAttestationPreference(attestation)
      }
      
      if let residentKey = options.authenticatorSelection?.residentKey {
        securityKeyRequest.residentKeyPreference = convertResidentKeyPreference(residentKey)
      }
      
      requests.append(securityKeyRequest)
    }
    
    // Check if we have any valid requests
    if requests.isEmpty {
      throw PasskeyRequestFailedException()
    }
    
    // Create auth controller and perform requests
    let authController = ASAuthorizationController(authorizationRequests: requests)
    delegate.performAuthForController(controller: authController)
  }
  
  @available(iOS 15.0, *)
  private func handleAuthenticatePasskey(requestJson: String, delegate: PasskeyDelegate, promise: Promise) throws {
    guard let requestData = requestJson.data(using: .utf8) else {
      throw InvalidChallengeException()
    }
    
    // Parse request
    let options = try JSONDecoder().decode(PublicKeyCredentialRequestOptions.self, from: requestData)
    
    // Get challenge
    guard let challenge = Data(base64URLEncoded: options.challenge) else {
      throw InvalidChallengeException()
    }
    
    var requests = [ASAuthorizationRequest]()
    
    // Create platform request
    let platformProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rpId)
    let platformRequest = platformProvider.createCredentialAssertionRequest(challenge: challenge)
    
    // Configure platform request
    if let userVerification = options.userVerification {
      platformRequest.userVerificationPreference = convertUserVerificationPreference(userVerification)
    }
    
    if let allowCredentials = options.allowCredentials, !allowCredentials.isEmpty {
      platformRequest.allowedCredentials = allowCredentials.compactMap { credential in
        guard let credentialData = Data(base64URLEncoded: credential.id) else {
          return nil
        }
        return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: credentialData)
      }
    }
    
    requests.append(platformRequest)
    
    // Create security key request
    let securityKeyProvider = ASAuthorizationSecurityKeyPublicKeyCredentialProvider(relyingPartyIdentifier: options.rpId)
    let securityKeyRequest = securityKeyProvider.createCredentialAssertionRequest(challenge: challenge)
    
    // Configure security key request
    if let userVerification = options.userVerification {
      securityKeyRequest.userVerificationPreference = convertUserVerificationPreference(userVerification)
    }
    
    if let allowCredentials = options.allowCredentials, !allowCredentials.isEmpty {
      securityKeyRequest.allowedCredentials = allowCredentials.compactMap { credential in
        guard let credentialData = Data(base64URLEncoded: credential.id) else {
          return nil
        }
        
        var transports = ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor.Transport.allSupported
        if let credentialTransports = credential.transports, !credentialTransports.isEmpty {
          transports = credentialTransports.compactMap { transport -> ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor.Transport? in
            switch transport {
            case "ble": return .bluetooth
            case "nfc": return .nfc
            case "usb": return .usb
            default: return nil
            }
          }
        }
        
        return ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor(
          credentialID: credentialData,
          transports: transports
        )
      }
    }
    
    requests.append(securityKeyRequest)
    
    // Create auth controller and perform requests
    let authController = ASAuthorizationController(authorizationRequests: requests)
    delegate.performAuthForController(controller: authController)
  }
  
  // MARK: - PasskeyResultHandler
  
  public func onSuccess(_ data: Any) {
    guard let delegate = passkeyDelegate else {
      return
    }
    
    // Reset the delegate to allow future operations
    passkeyDelegate = nil
    
    do {
      // Convert to dictionary and then to JSON string
      let json: [String: Any]
      
      if let registrationData = data as? RegistrationResponseJSON {
        // Manually create dictionary representation
        var responseDict: [String: Any] = [
          "type": registrationData.type
        ]
        
        if let attachment = registrationData.authenticatorAttachment {
          responseDict["authenticatorAttachment"] = attachment
        }
        
        responseDict["id"] = registrationData.id
        responseDict["rawId"] = registrationData.rawId
        
        // Create response dictionary
        var responseObjDict: [String: Any] = [
          "clientDataJSON": registrationData.response.clientDataJSON,
          "attestationObject": registrationData.response.attestationObject
        ]
        
        if let publicKey = registrationData.response.publicKey {
          responseObjDict["publicKey"] = publicKey
        }
        
        if let publicKeyAlg = registrationData.response.publicKeyAlgorithm {
          responseObjDict["publicKeyAlgorithm"] = publicKeyAlg
        }
        
        if let transports = registrationData.response.transports {
          responseObjDict["transports"] = transports
        }
        
        responseDict["response"] = responseObjDict
        
        json = responseDict
      } else if let authData = data as? AuthenticationResponseJSON {
        // Manually create dictionary representation
        var responseDict: [String: Any] = [
          "type": authData.type
        ]
        
        if let attachment = authData.authenticatorAttachment {
          responseDict["authenticatorAttachment"] = attachment
        }
        
        responseDict["id"] = authData.id
        responseDict["rawId"] = authData.rawId
        
        // Create response dictionary
        var responseObjDict: [String: Any] = [
          "authenticatorData": authData.response.authenticatorData,
          "clientDataJSON": authData.response.clientDataJSON,
          "signature": authData.response.signature
        ]
        
        if let userHandle = authData.response.userHandle {
          responseObjDict["userHandle"] = userHandle
        }
        
        responseDict["response"] = responseObjDict
        
        json = responseDict
      } else {
        throw UnknownException()
      }
      
      // Convert dictionary to JSON
      let jsonData = try JSONSerialization.data(withJSONObject: json, options: [])
      
      if let jsonString = String(data: jsonData, encoding: .utf8) {
        delegate.promise?.resolve(jsonString)
      } else {
        throw UnknownException()
      }
    } catch {
      print("Error serializing passkey response: \(error)")
      delegate.promise?.reject(UnknownException())
    }
  }
  
  public func onFailure(_ error: Error) {
    guard let delegate = passkeyDelegate else {
      return
    }

    // Reset the delegate to allow future operations
    passkeyDelegate = nil

    // Log detailed error information for debugging
    print("[ExpoPasskey] Authentication failed with error: \(error)")
    print("[ExpoPasskey] Error domain: \(error._domain)")
    print("[ExpoPasskey] Error code: \(error._code)")
    print("[ExpoPasskey] Error description: \(error.localizedDescription)")

    // Convert the error to an appropriate exception
    if let asError = error as? ASAuthorizationError {
      print("[ExpoPasskey] ASAuthorizationError code: \(asError.code.rawValue)")

      switch asError.code {
      case .canceled:
        delegate.promise?.reject(UserCancelledException())
      case .failed:
        // Log additional context for failed requests
        print("[ExpoPasskey] ASAuthorizationError.failed - Common causes:")
        print("[ExpoPasskey]   1. Associated Domains not configured in app.json")
        print("[ExpoPasskey]   2. Apple App Site Association file not accessible or misconfigured")
        print("[ExpoPasskey]   3. Domain mismatch between app and server rpId")
        print("[ExpoPasskey]   4. Bundle ID mismatch in AASA file")
        print("[ExpoPasskey] Underlying error: \(asError.localizedDescription)")
        if let underlyingError = asError.errorUserInfo[NSUnderlyingErrorKey] as? NSError {
          print("[ExpoPasskey] Underlying error details: \(underlyingError)")
        }
        delegate.promise?.reject(PasskeyRequestFailedException())
      case .invalidResponse:
        delegate.promise?.reject(PasskeyAuthorizationFailedException())
      case .notHandled:
        print("[ExpoPasskey] ASAuthorizationError.notHandled - Request was not handled")
        delegate.promise?.reject(UnknownException())
      case .unknown:
        print("[ExpoPasskey] ASAuthorizationError.unknown")
        delegate.promise?.reject(UnknownException())
      @unknown default:
        print("[ExpoPasskey] Unknown ASAuthorizationError code: \(asError.code.rawValue)")
        delegate.promise?.reject(UnknownException())
      }
    } else {
      print("[ExpoPasskey] Non-ASAuthorizationError: \(type(of: error))")
      delegate.promise?.reject(UnknownException())
    }
  }
  
  // MARK: - Helper Methods
  
  @available(iOS 15.0, *)
  private func convertUserVerificationPreference(_ value: String) -> ASAuthorizationPublicKeyCredentialUserVerificationPreference {
    switch value {
    case "required":
      return .required
    case "preferred":
      return .preferred
    case "discouraged":
      return .discouraged
    default:
      return .preferred
    }
  }
  
  @available(iOS 15.0, *)
  private func convertResidentKeyPreference(_ value: String) -> ASAuthorizationPublicKeyCredentialResidentKeyPreference {
    switch value {
    case "required":
      return .required
    case "preferred":
      return .preferred
    case "discouraged":
      return .discouraged
    default:
      return .preferred
    }
  }
  
  @available(iOS 15.0, *)
  private func convertAttestationPreference(_ value: String) -> ASAuthorizationPublicKeyCredentialAttestationKind {
    switch value {
    case "direct":
      return .direct
    case "indirect":
      return .indirect
    case "none":
      return .none
    case "enterprise":
      return .enterprise
    default:
      return .none
    }
  }
}

// Extension for biometric type checking
extension LAContext {
  enum BiometricType: String {
    case none
    case touchID
    case faceID
    case opticID
  }
  
  var biometricType: BiometricType {
    var error: NSError?
    
    guard self.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
      return .none
    }
    
    if #available(iOS 11.0, *) {
      switch self.biometryType {
      case .none:
        return .none
      case .touchID:
        return .touchID
      case .faceID:
        return .faceID
      case .opticID:
        if #available(iOS 17.0, *) {
          return .opticID
        } else {
          return .none
        }
      @unknown default:
        return .none
      }
    }
    
    return self.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) ? .touchID : .none
  }
}