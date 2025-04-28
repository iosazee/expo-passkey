import ExpoModulesCore

/// Error cases for passkey operations
enum PasskeyError: Error {
    case unsupported(String)
    case invalidRequest(String)
    case missingParameters(String)
    case invalidParameter(String)
    case noViewController(String)
    case userCanceled(String)
    case authFailed(String)
    case notInteractive(String)
    case invalidResponse(String)
    case notHandled(String)
    case biometryUnavailable(String)
    case biometryNotEnrolled(String)
    case biometryLockout(String)
    case biometryFailed(String)
    case missingData(String)
    case invalidData(String)
    case cborDecodingFailed(String)
    case unsupportedKeyType(String)
    case encodingFailed(String)
    case unknownCredentialType(String)
    case unknown(String)
    
    var code: String {
        switch self {
        case .unsupported: return "ERR_UNSUPPORTED"
        case .invalidRequest: return "ERR_INVALID_REQUEST"
        case .missingParameters: return "ERR_MISSING_PARAMETERS"
        case .invalidParameter: return "ERR_INVALID_PARAMETER"
        case .noViewController: return "ERR_NO_VIEW_CONTROLLER"
        case .userCanceled: return "ERR_USER_CANCELED"
        case .authFailed: return "ERR_AUTH_FAILED"
        case .notInteractive: return "ERR_NOT_INTERACTIVE"
        case .invalidResponse: return "ERR_INVALID_RESPONSE"
        case .notHandled: return "ERR_NOT_HANDLED"
        case .biometryUnavailable: return "ERR_BIOMETRY_UNAVAILABLE"
        case .biometryNotEnrolled: return "ERR_BIOMETRY_NOT_ENROLLED"
        case .biometryLockout: return "ERR_BIOMETRY_LOCKOUT"
        case .biometryFailed: return "ERR_BIOMETRY_FAILED"
        case .missingData: return "ERR_MISSING_DATA"
        case .invalidData: return "ERR_INVALID_DATA"
        case .cborDecodingFailed: return "ERR_CBOR_DECODING_FAILED"
        case .unsupportedKeyType: return "ERR_UNSUPPORTED_KEY_TYPE"
        case .encodingFailed: return "ERR_ENCODING_FAILED"
        case .unknownCredentialType: return "ERR_UNKNOWN_CREDENTIAL_TYPE"
        case .unknown: return "ERR_UNKNOWN"
        }
    }
    
    var message: String {
        switch self {
        case .unsupported(let msg): return msg
        case .invalidRequest(let msg): return msg
        case .missingParameters(let msg): return msg
        case .invalidParameter(let msg): return msg
        case .noViewController(let msg): return msg
        case .userCanceled(let msg): return msg
        case .authFailed(let msg): return msg
        case .notInteractive(let msg): return msg
        case .invalidResponse(let msg): return msg
        case .notHandled(let msg): return msg
        case .biometryUnavailable(let msg): return msg
        case .biometryNotEnrolled(let msg): return msg
        case .biometryLockout(let msg): return msg
        case .biometryFailed(let msg): return msg
        case .missingData(let msg): return msg
        case .invalidData(let msg): return msg
        case .cborDecodingFailed(let msg): return msg
        case .unsupportedKeyType(let msg): return msg
        case .encodingFailed(let msg): return msg
        case .unknownCredentialType(let msg): return msg
        case .unknown(let msg): return msg
        }
    }
}

// Extension to make PasskeyError compatible with ExpoModulesCore's error handling
extension PasskeyError: ExpoCoreError {
    var errorCode: String {
        return code
    }
    
    var errorMessage: String {
        return message
    }
}