import ExpoModulesCore
import AuthenticationServices
import LocalAuthentication

public class ExpoPasskeyModule: Module {
  // Store delegate reference conditionally based on iOS version
  @available(iOS 16.0, *)
  private var authDelegateIOS16: PasskeyAuthorizationDelegate?
  
  public func definition() -> ModuleDefinition {
    Name("ExpoPasskeyModule")
    
    // Check if passkeys are supported on this device
    Function("isPasskeySupported") { () -> Bool in
      // Runtime check for iOS 16+ 
      if #available(iOS 16.0, *) {
        // Check if biometric authentication is available
        let context = LAContext()
        var error: NSError?
        
        // We need biometric authentication for passkeys
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
          return true
        }
        return false
      } else {
        // Not supported on iOS < 16
        return false
      }
    }
    
    // Create a new passkey (WebAuthn credential registration)
    AsyncFunction("createPasskey") { (options: [String: Any], promise: Promise) in
      // Runtime check for iOS 16+
      guard #available(iOS 16.0, *) else {
        promise.reject(PasskeyError.unsupported("Passkeys require iOS 16 or later"))
        return
      }
      
      // Parse WebAuthn request from JSON
      guard let requestJson = options["requestJson"] as? String,
            let requestData = requestJson.data(using: .utf8),
            let requestOptions = try? JSONSerialization.jsonObject(with: requestData) as? [String: Any]
      else {
        promise.reject(PasskeyError.invalidRequest("Invalid registration options format"))
        return
      }
      
      // Extract required fields
      guard let rpId = requestOptions["rpId"] as? String,
            let challengeB64 = requestOptions["challenge"] as? String,
            let userInfo = requestOptions["user"] as? [String: Any],
            let userId = userInfo["id"] as? String,
            let userName = userInfo["name"] as? String
      else {
        promise.reject(PasskeyError.missingParameters("Missing required registration parameters"))
        return
      }
      
      // Convert base64url challenge to Data
      guard let challengeData = Data(base64URLEncoded: challengeB64) else {
        promise.reject(PasskeyError.invalidParameter("Invalid challenge format"))
        return
      }
      
      // Convert userId from base64url if needed
      let userIdData: Data
      if let decodedUserId = Data(base64URLEncoded: userId) {
        userIdData = decodedUserId
      } else {
        userIdData = userId.data(using: .utf8) ?? Data()
      }
      
      // Create provider based on authenticator attachment preference
      let authenticatorSelection = requestOptions["authenticatorSelection"] as? [String: Any]
      let authenticatorAttachment = authenticatorSelection?["authenticatorAttachment"] as? String
      
      // Create array to hold registration requests
      var registrationRequests: [ASAuthorizationRequest] = []
      
      // Always add platform request first (most commonly used)
      let platformProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
      let platformRequest = platformProvider.createCredentialRegistrationRequest(
        challenge: challengeData,
        name: userName,
        userID: userIdData
      )
      
      // Configure platform request
      if let userVerification = authenticatorSelection?["userVerification"] as? String {
        platformRequest.userVerificationPreference = getUserVerificationPreference(userVerification)
      }
      
      // Add platform request
      registrationRequests.append(platformRequest)
      
      // Add cross-platform request if specified or if we should support all types
      if authenticatorAttachment == "cross-platform" || authenticatorAttachment == nil {
        let securityKeyProvider = ASAuthorizationSecurityKeyPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
        let securityKeyRequest = securityKeyProvider.createCredentialRegistrationRequest(
          challenge: challengeData,
          displayName: userInfo["displayName"] as? String ?? userName,
          name: userName,
          userID: userIdData
        )
        
        // Configure security key request
        if let userVerification = authenticatorSelection?["userVerification"] as? String {
          securityKeyRequest.userVerificationPreference = getUserVerificationPreference(userVerification)
        }
        
        // Add parameters for credential algorithm if specified
        if let pubKeyCredParams = requestOptions["pubKeyCredParams"] as? [[String: Any]] {
          let credentialParameters = pubKeyCredParams.compactMap { param -> ASAuthorizationPublicKeyCredentialParameters? in
            guard let alg = param["alg"] as? Int else { return nil }
            // Fixed: Use ASCOSEAlgorithmIdentifier directly
            return ASAuthorizationPublicKeyCredentialParameters(algorithm: ASCOSEAlgorithmIdentifier(alg))
          }
          
          if !credentialParameters.isEmpty {
            securityKeyRequest.credentialParameters = credentialParameters
          }
        }
        
        // Add security key request
        registrationRequests.append(securityKeyRequest)
      }
      
      // Create authorization controller with all applicable requests
      let authController = ASAuthorizationController(authorizationRequests: registrationRequests)
      
      // Create and keep reference to delegate (with iOS 16 availability)
      self.authDelegateIOS16 = PasskeyAuthorizationDelegate(promise: promise)
      authController.delegate = self.authDelegateIOS16
      
      // Present authorization UI
      if let viewController = appContext?.utilities?.currentViewController() {
        authController.presentationContextProvider = self.authDelegateIOS16
        authController.performRequests()
      } else {
        promise.reject(PasskeyError.noViewController("No view controller available"))
      }
    }
    
    // Authenticate with an existing passkey
    AsyncFunction("authenticateWithPasskey") { (options: [String: Any], promise: Promise) in
      // Runtime check for iOS 16+
      guard #available(iOS 16.0, *) else {
        promise.reject(PasskeyError.unsupported("Passkeys require iOS 16 or later"))
        return
      }
      
      // Parse WebAuthn request from JSON
      guard let requestJson = options["requestJson"] as? String,
            let requestData = requestJson.data(using: .utf8),
            let requestOptions = try? JSONSerialization.jsonObject(with: requestData) as? [String: Any]
      else {
        promise.reject(PasskeyError.invalidRequest("Invalid authentication options format"))
        return
      }
      
      // Extract required fields
      guard let rpId = requestOptions["rpId"] as? String,
            let challengeB64 = requestOptions["challenge"] as? String
      else {
        promise.reject(PasskeyError.missingParameters("Missing required authentication parameters"))
        return
      }
      
      // Convert base64url challenge to Data
      guard let challengeData = Data(base64URLEncoded: challengeB64) else {
        promise.reject(PasskeyError.invalidParameter("Invalid challenge format"))
        return
      }
      
      // Create array to hold authentication requests
      var assertionRequests: [ASAuthorizationRequest] = []
      
      // Create platform provider request (built-in passkeys)
      let platformProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
      let platformAssertionRequest = platformProvider.createCredentialAssertionRequest(challenge: challengeData)
      
      // Create security key provider request (external authenticators)
      let securityKeyProvider = ASAuthorizationSecurityKeyPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
      let securityKeyAssertionRequest = securityKeyProvider.createCredentialAssertionRequest(challenge: challengeData)
      
      // Configure user verification preference if provided
      if let userVerification = requestOptions["userVerification"] as? String {
        let verificationPreference = getUserVerificationPreference(userVerification)
        platformAssertionRequest.userVerificationPreference = verificationPreference
        securityKeyAssertionRequest.userVerificationPreference = verificationPreference
      }
      
      // Configure allowed credentials if provided
      if let allowCredentials = requestOptions["allowCredentials"] as? [[String: Any]] {
        let platformAllowedCredentials = allowCredentials.compactMap { credential -> ASAuthorizationPlatformPublicKeyCredentialDescriptor? in
          guard let credIdB64 = credential["id"] as? String,
                let credIdData = Data(base64URLEncoded: credIdB64) else {
            return nil
          }
          
          return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: credIdData)
        }
        
        let securityKeyAllowedCredentials = allowCredentials.compactMap { credential -> ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor? in
          guard let credIdB64 = credential["id"] as? String,
                let credIdData = Data(base64URLEncoded: credIdB64) else {
            return nil
          }
          
          // Parse transports if provided
          var transports = ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor.Transport.allSupported
          if let transportStrings = credential["transports"] as? [String] {
            transports = transportStrings.compactMap { transportString -> ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor.Transport? in
              switch transportString {
              case "usb": return .usb
              case "nfc": return .nfc
              case "ble": return .bluetooth
              default: return nil
              }
            }
            
            if transports.isEmpty {
              transports = ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor.Transport.allSupported
            }
          }
          
          return ASAuthorizationSecurityKeyPublicKeyCredentialDescriptor(
            credentialID: credIdData,
            transports: transports
          )
        }
        
        if !platformAllowedCredentials.isEmpty {
          platformAssertionRequest.allowedCredentials = platformAllowedCredentials
        }
        
        if !securityKeyAllowedCredentials.isEmpty {
          securityKeyAssertionRequest.allowedCredentials = securityKeyAllowedCredentials
        }
      }
      
      // Add platform request
      assertionRequests.append(platformAssertionRequest)
      
      // Add security key request
      assertionRequests.append(securityKeyAssertionRequest)
      
      // Create authorization controller with both request types
      let authController = ASAuthorizationController(authorizationRequests: assertionRequests)
      
      // Create and keep reference to delegate (with iOS 16 availability)
      self.authDelegateIOS16 = PasskeyAuthorizationDelegate(promise: promise)
      authController.delegate = self.authDelegateIOS16
      
      // Present authorization UI
      if let viewController = appContext?.utilities?.currentViewController() {
        authController.presentationContextProvider = self.authDelegateIOS16
        authController.performRequests()
      } else {
        promise.reject(PasskeyError.noViewController("No view controller available"))
      }
    }
  }
  
  // Helper to convert user verification string to Apple's enum
  private func getUserVerificationPreference(_ userVerification: String) -> ASAuthorizationPublicKeyCredentialUserVerificationPreference {
    switch userVerification {
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
}