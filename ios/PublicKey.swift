import Foundation

/// Extracts the public key from an attestation object
/// - Parameter attestationObject: Raw attestation object data
/// - Returns: Extracted public key or nil if extraction fails
@available(iOS 16.0, *)
func getPublicKey(from attestationObject: Data) throws -> Data? {
    let cborDecoded: Any
    do {
        cborDecoded = try SimpleCBORDecoder.decode(attestationObject)
    } catch {
        throw PasskeyError.cborDecodingFailed("Failed to decode attestation object: \(error.localizedDescription)")
    }
    
    guard let decodedAttestationObjectMap = cborDecoded as? [String: Any],
          let authData = decodedAttestationObjectMap["authData"] as? Data
    else {
        throw PasskeyError.missingData("Failed to extract authData from attestation object")
    }

    // Parse authenticator data - ensure it has minimum size
    guard authData.count >= 37 else {
        throw PasskeyError.invalidData("Authenticator data too short")
    }

    // Extract flags - flags start after the RP ID hash (the first 32 bytes)
    let flags = authData[32]
    
    // Check if attested credential data is present (bit 6 of flags)
    guard (flags & 0x40) != 0 else {
        throw PasskeyError.missingData("No attested credential data present")
    }

    // Skip the RP ID hash (32 bytes), flags (1 byte) and counter (4 bytes)
    var index = 37

    // Skip the AAGUID (16 bytes)
    index += 16

    // Ensure there's enough data to read credential ID length
    guard authData.count >= index + 2 else {
        throw PasskeyError.invalidData("No credential ID found")
    }
    
    // Get credential ID length (2 bytes, big-endian)
    let credentialIdLength = UInt16(authData[index]) << 8 | UInt16(authData[index + 1])

    // Skip credential ID length bytes (2 bytes)
    index += 2

    // Ensure there's enough data for the credential ID
    guard authData.count >= index + Int(credentialIdLength) else {
        throw PasskeyError.invalidData("Credential ID data truncated")
    }

    // Skip the credential ID bytes (variable length from above)
    index += Int(credentialIdLength)

    // Ensure there's enough data for public key
    guard authData.count > index else {
        throw PasskeyError.missingData("No public key data found")
    }

    // Extract COSE key bytes
    let publicKeyBytes = [UInt8](authData[index...])

    // Decode COSE key
    let decodedPublicKey: Any
    do {
        decodedPublicKey = try SimpleCBORDecoder.decode(publicKeyBytes)
    } catch {
        throw PasskeyError.cborDecodingFailed("Failed to decode COSE key: \(error.localizedDescription)")
    }

    guard let cosePublicKey = decodedPublicKey as? [AnyHashable: Any] else {
        throw PasskeyError.invalidData("Failed to parse COSE key")
    }

    // Extract key components based on standard COSE key labels
    // -1: curve, -2: x-coordinate, -3: y-coordinate, 1: key type, 3: algorithm
    guard let curve = cosePublicKey[-1] as? Int64,
          let xCoordinate = cosePublicKey[-2] as? Data,
          let yCoordinate = cosePublicKey[-3] as? Data,
          let keyType = cosePublicKey[1] as? Int64,
          let algorithm = cosePublicKey[3] as? Int64
    else {
        throw PasskeyError.missingData("Failed to extract key components")
    }

    // Verify this is an EC2 key (keyType=2) with ES256 algorithm (algorithm=-7) on P-256 curve (curve=1)
    // See: https://www.w3.org/TR/webauthn-3/#sctn-public-key-attestation
    guard keyType == 2, algorithm == -7, curve == 1 else {
        throw PasskeyError.unsupportedKeyType("Only EC2 P-256 keys with ES256 algorithm are supported")
    }

    // Combine x and y coordinates to form complete public key
    let publicKeyData = Data(xCoordinate + yCoordinate)
    return publicKeyData
}

// COSE algorithm identifiers
typealias COSEAlgorithmIdentifier = Int