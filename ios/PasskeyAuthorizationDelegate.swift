import ExpoModulesCore
import AuthenticationServices
import LocalAuthentication

// Make the entire class conditionally available for iOS 16+
@available(iOS 16.0, *)
class PasskeyAuthorizationDelegate: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  private let promise: Promise
  
  init(promise: Promise) {
    self.promise = promise
    super.init()
  }
  
  // MARK: - ASAuthorizationControllerDelegate
  
  func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
    do {
      // Handle successful authorization based on credential type
      if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
        // Handle passkey registration
        guard let attestationObject = credential.rawAttestationObject else {
          promise.reject("ERR_MISSING_DATA", "Missing attestation object in registration response")
          return
        }
        
        // Extract public key from attestation object
        let publicKey = try getPublicKey(from: attestationObject)
        
        let responseDict: [String: Any] = [
          "id": credential.credentialID.toBase64URLEncodedString(),
          "rawId": credential.credentialID.toBase64URLEncodedString(),
          "type": "public-key",
          "response": [
            "clientDataJSON": credential.rawClientDataJSON.toBase64URLEncodedString(),
            "attestationObject": attestationObject.toBase64URLEncodedString(),
            "publicKey": publicKey?.toBase64URLEncodedString() ?? "",
            "transports": ["internal"]
          ],
          "authenticatorAttachment": "platform"
        ]
        
        // Convert to JSON string to match the TypeScript interface
        let jsonData = try JSONSerialization.data(withJSONObject: responseDict, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
          promise.reject("ERR_ENCODING_FAILED", "Failed to encode response as JSON string")
          return
        }
        
        promise.resolve(jsonString)
      } else if let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
        // Handle passkey authentication
        let responseDict: [String: Any] = [
          "id": credential.credentialID.toBase64URLEncodedString(),
          "rawId": credential.credentialID.toBase64URLEncodedString(),
          "type": "public-key",
          "response": [
            "clientDataJSON": credential.rawClientDataJSON.toBase64URLEncodedString(),
            "authenticatorData": credential.rawAuthenticatorData.toBase64URLEncodedString(),
            "signature": credential.signature.toBase64URLEncodedString(),
            "userHandle": credential.userID.toBase64URLEncodedString()
          ],
          "authenticatorAttachment": "platform"
        ]
        
        // Convert to JSON string to match the TypeScript interface
        let jsonData = try JSONSerialization.data(withJSONObject: responseDict, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
          promise.reject("ERR_ENCODING_FAILED", "Failed to encode response as JSON string")
          return
        }
        
        promise.resolve(jsonString)
      } else if let credential = authorization.credential as? ASAuthorizationSecurityKeyPublicKeyCredentialRegistration {
        // Handle security key registration (cross-platform)
        guard let attestationObject = credential.rawAttestationObject else {
          promise.reject("ERR_MISSING_DATA", "Missing attestation object in registration response")
          return
        }
        
        // Extract public key from attestation object
        let publicKey = try getPublicKey(from: attestationObject)
        
        // Determine which transports were used
        let transports = ["usb", "nfc", "ble"] // Common transports for security keys
        
        let responseDict: [String: Any] = [
          "id": credential.credentialID.toBase64URLEncodedString(),
          "rawId": credential.credentialID.toBase64URLEncodedString(),
          "type": "public-key",
          "response": [
            "clientDataJSON": credential.rawClientDataJSON.toBase64URLEncodedString(),
            "attestationObject": attestationObject.toBase64URLEncodedString(),
            "publicKey": publicKey?.toBase64URLEncodedString() ?? "",
            "transports": transports
          ],
          "authenticatorAttachment": "cross-platform"
        ]
        
        // Convert to JSON string to match the TypeScript interface
        let jsonData = try JSONSerialization.data(withJSONObject: responseDict, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
          promise.reject("ERR_ENCODING_FAILED", "Failed to encode response as JSON string")
          return
        }
        
        promise.resolve(jsonString)
      } else if let credential = authorization.credential as? ASAuthorizationSecurityKeyPublicKeyCredentialAssertion {
        // Handle security key authentication (cross-platform)
        let responseDict: [String: Any] = [
          "id": credential.credentialID.toBase64URLEncodedString(),
          "rawId": credential.credentialID.toBase64URLEncodedString(),
          "type": "public-key",
          "response": [
            "clientDataJSON": credential.rawClientDataJSON.toBase64URLEncodedString(),
            "authenticatorData": credential.rawAuthenticatorData.toBase64URLEncodedString(),
            "signature": credential.signature.toBase64URLEncodedString(),
            "userHandle": credential.userID.toBase64URLEncodedString()
          ],
          "authenticatorAttachment": "cross-platform"
        ]
        
        // Convert to JSON string to match the TypeScript interface
        let jsonData = try JSONSerialization.data(withJSONObject: responseDict, options: [])
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
          promise.reject("ERR_ENCODING_FAILED", "Failed to encode response as JSON string")
          return
        }
        
        promise.resolve(jsonString)
      } else {
        // Unknown credential type
        promise.reject("ERR_UNKNOWN_CREDENTIAL_TYPE", "Unknown credential type")
      }
    } catch {
      // Handle any errors that occurred during processing
      if let error = error as? PasskeyError {
        promise.reject(error.code, error.message)
      } else {
        promise.reject("ERR_UNKNOWN", "Failed to process credential: \(error.localizedDescription)")
      }
    }
  }
  
  func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
    // Enhanced error handling with detailed codes and messages
    if let authError = error as? ASAuthorizationError {
      switch authError.code {
      case .canceled:
        promise.reject("ERR_USER_CANCELED", "User canceled the authorization")
      case .notInteractive:
        promise.reject("ERR_NOT_INTERACTIVE", "Authentication must be interactive")
      case .failed:
        promise.reject("ERR_AUTH_FAILED", "Authentication failed")
      case .invalidResponse:
        promise.reject("ERR_INVALID_RESPONSE", "Invalid authentication response")
      case .notHandled:
        promise.reject("ERR_NOT_HANDLED", "Authentication request not handled")
      case .unknown:
        promise.reject("ERR_UNKNOWN", "Unknown authentication error: \(authError.localizedDescription)")
      @unknown default:
        promise.reject("ERR_UNKNOWN", "Authentication failed: \(authError.localizedDescription)")
      }
    } else if let laError = error as? LAError {
      // Handle LocalAuthentication errors
      switch laError.code {
      case .biometryNotAvailable:
        promise.reject("ERR_BIOMETRY_UNAVAILABLE", "Biometric authentication is not available")
      case .biometryNotEnrolled:
        promise.reject("ERR_BIOMETRY_NOT_ENROLLED", "Biometric authentication is not set up")
      case .biometryLockout:
        promise.reject("ERR_BIOMETRY_LOCKOUT", "Biometric authentication is locked out")
      default:
        promise.reject("ERR_BIOMETRY_FAILED", "Biometric authentication failed: \(laError.localizedDescription)")
      }
    } else {
      promise.reject("ERR_UNKNOWN", "Authentication failed: \(error.localizedDescription)")
    }
  }
  
  // MARK: - ASAuthorizationControllerPresentationContextProviding
  
  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    // Find the appropriate window for presentation
    if let keyWindow = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {
      return keyWindow
    }
    
    // Fallback to the first window
    if let window = UIApplication.shared.windows.first {
      return window
    }
    
    // Last resort fallback
    return UIWindow()
  }
}