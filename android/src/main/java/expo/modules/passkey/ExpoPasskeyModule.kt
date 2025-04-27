package expo.modules.passkey

import android.app.Activity
import android.os.Build
import android.util.Log
import androidx.activity.ComponentActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Expo Native Module for WebAuthn Passkey operations
 * This module exposes WebAuthn functionality to React Native/Expo
 */
class ExpoPasskeyModule : Module() {
  private val TAG = "ExpoPasskeyModule"
  private val mainScope = CoroutineScope(Dispatchers.Main)
  private var credentialManager: PasskeyCredentialManager? = null
  
  override fun definition() = ModuleDefinition {
    // Important: Make sure the name is consistent with what's expected in JS
    Name("ExpoPasskeyModule")
    
    OnCreate {
      // Initialize the credential manager when the module is created
      credentialManager = PasskeyCredentialManager(appContext.reactContext)
      Log.d(TAG, "ExpoPasskeyModule initialized")
    }
    
    // Check if WebAuthn/passkeys are supported on this device
    Function("isPasskeySupported") {
      try {
        // Check Android version
        val androidVersion = Build.VERSION.SDK_INT
        Log.d(TAG, "Checking passkey support - Android API level: $androidVersion")
        
        // According to Google's documentation, passkeys are supported on Android 9+ (API level 28+)
        if (androidVersion < 28) {
          Log.d(TAG, "Passkey not supported - Android version too low (minimum required is Android 9/API 28)")
          return@Function false
        }
        
        // Delegate to credential manager for more thorough checks
        val isSupported = credentialManager?.isSupported() ?: false
        Log.d(TAG, "Passkey supported via CredentialManager: $isSupported")
        return@Function isSupported
      } catch (e: Exception) {
        // If there's any error in checking, log it and return false to be safe
        Log.e(TAG, "Error checking passkey support: ${e.message}", e)
        return@Function false
      }
    }
    
    // Create a new passkey (Registration flow)
    AsyncFunction("createPasskey") { options: Map<String, Any>, promise: Promise ->
      val activity = appContext.currentActivity
      
      // Activity validation with detailed error
      if (activity == null) {
        return@AsyncFunction promise.reject(PasskeyError("ERR_NO_ACTIVITY", "No current activity available"))
      }
      
      if (activity !is ComponentActivity) {
        return@AsyncFunction promise.reject(PasskeyError("ERR_INVALID_ACTIVITY", "Activity is not a ComponentActivity. Make sure you're using an AppCompat or AndroidX activity"))
      }
      
      // Check for passkey support
      if (credentialManager?.isSupported() != true) {
        val errorMsg = if (Build.VERSION.SDK_INT < 28) {
          "Passkeys require Android 9 (API 28) or later"
        } else {
          "Passkeys are not supported on this device. Ensure biometric authentication is set up"
        }
        return@AsyncFunction promise.reject(PasskeyError("ERR_UNSUPPORTED", errorMsg))
      }
      
      val requestJson = options["requestJson"] as? String
        ?: return@AsyncFunction promise.reject(PasskeyError("ERR_INVALID_ARGS", "Missing requestJson parameter"))
      
      try {
        // Launch background operation
        mainScope.launch {
          try {
            val result = credentialManager?.createPasskey(activity, requestJson)
              ?: throw Exception("Credential manager not initialized")
            
            // Convert JSON result to a string
            val resultString = result.toString()
            Log.d(TAG, "Passkey created successfully")
            promise.resolve(resultString)
          } catch (e: Exception) {
            Log.e(TAG, "Failed to create passkey: ${e.message}", e)
            val errorCode = mapExceptionToErrorCode(e)
            promise.reject(errorCode, e.message ?: "Unknown error creating passkey", e)
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "Error initiating passkey creation: ${e.message}", e)
        promise.reject(PasskeyError("ERR_UNEXPECTED", "Unexpected error: ${e.message}"))
      }
    }
    
    // Authenticate with passkey (Authentication flow)
    AsyncFunction("authenticateWithPasskey") { options: Map<String, Any>, promise: Promise ->
      val activity = appContext.currentActivity
      
      // Better activity validation with detailed error
      if (activity == null) {
        return@AsyncFunction promise.reject(PasskeyError("ERR_NO_ACTIVITY", "No current activity available"))
      }
      
      if (activity !is ComponentActivity) {
        return@AsyncFunction promise.reject(PasskeyError("ERR_INVALID_ACTIVITY", "Activity is not a ComponentActivity. Make sure you're using an AppCompat or AndroidX activity"))
      }
      
      // Check for passkey support
      if (credentialManager?.isSupported() != true) {
        val errorMsg = if (Build.VERSION.SDK_INT < 28) {
          "Passkeys require Android 9 (API 28) or later"
        } else {
          "Passkeys are not supported on this device. Ensure biometric authentication is set up"
        }
        return@AsyncFunction promise.reject(PasskeyError("ERR_UNSUPPORTED", errorMsg))
      }
      
      val requestJson = options["requestJson"] as? String
        ?: return@AsyncFunction promise.reject(PasskeyError("ERR_INVALID_ARGS", "Missing requestJson parameter"))
      
      try {
        // Launch background operation
        mainScope.launch {
          try {
            val result = credentialManager?.authenticateWithPasskey(activity, requestJson)
              ?: throw Exception("Credential manager not initialized")
            
            // Convert JSON result to a string
            val resultString = result.toString()
            Log.d(TAG, "Passkey authentication successful")
            promise.resolve(resultString)
          } catch (e: Exception) {
            Log.e(TAG, "Failed to authenticate with passkey: ${e.message}", e)
            val errorCode = mapExceptionToErrorCode(e)
            promise.reject(errorCode, e.message ?: "Unknown error during authentication", e)
          }
        }
      } catch (e: Exception) {
        Log.e(TAG, "Error initiating passkey authentication: ${e.message}", e)
        promise.reject(PasskeyError("ERR_UNEXPECTED", "Unexpected error: ${e.message}"))
      }
    }
  }
  
  // Helper method to map exceptions to standard error codes
  private fun mapExceptionToErrorCode(e: Exception): String {
    val message = e.message?.lowercase() ?: ""
    return when {
      message.contains("canceled") -> "ERR_CANCELED"
      message.contains("interrupt") -> "ERR_INTERRUPTED"
      message.contains("configuration") -> "ERR_PROVIDER_CONFIG"
      message.contains("not supported") -> "ERR_UNSUPPORTED"
      message.contains("no passkey") || message.contains("no credential") -> "ERR_NO_CREDENTIALS"
      message.contains("webauthn") -> "ERR_WEBAUTHN"
      else -> "ERR_OPERATION_FAILED"
    }
  }
  
  // Custom error class for better error handling
  class PasskeyError(code: String, message: String) : CodedException(code, message)
}