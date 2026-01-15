import ExpoModulesCore

// Define custom exceptions for passkey operations
internal class NotConfiguredException: Exception {
  override var reason: String {
    "Your Apple app site association is not properly configured."
  }
}

internal class PendingPasskeyRequestException: Exception {
  override var reason: String {
    "There is already a pending passkey request"
  }
}

internal class NotSupportedException: Exception {
  override var reason: String {
    "Passkeys are not supported on this iOS version. Please use iOS 15 or above"
  }
}

internal class BiometricException: Exception {
  override var reason: String {
    "Biometrics must be enabled"
  }
}

internal class UserCancelledException: Exception {
  override var reason: String {
    "User cancelled the passkey interaction"
  }
}

internal class InvalidChallengeException: Exception {
  override var reason: String {
    "The provided challenge was invalid"
  }
}

internal class InvalidUserIdException: Exception {
  override var reason: String {
    "The provided userId was invalid"
  }
}

internal class PasskeyRequestFailedException: Exception {
  override var reason: String {
    """
    The passkey request failed. This usually indicates a configuration issue:
    1. Check Associated Domains in app.json (webcredentials:yourdomain.com)
    2. Verify Apple App Site Association file is accessible at https://yourdomain.com/.well-known/apple-app-site-association
    3. Ensure rpId in server config matches your domain
    4. Verify Bundle ID in AASA file matches your app
    Check Xcode console logs for detailed error information.
    """
  }
}

internal class PasskeyAuthorizationFailedException: Exception {
  override var reason: String {
    "The passkey authorization failed"
  }
}

internal class UnknownException: Exception {
  override var reason: String {
    "An unknown exception occurred"
  }
}