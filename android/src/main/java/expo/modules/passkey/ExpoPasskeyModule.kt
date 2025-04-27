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
        
        // Always consider Android 14+ (API 34+) as supported
        if (androidVersion >= 34) {
          Log.d(TAG, "Android 14+ detected, assuming passkey support is available")
          return@Function true
        }
        
        // For Android 9-13, check credential manager
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
      val activity = appContext.currentActivity as? ComponentActivity
        ?: return@AsyncFunction promise.reject(PasskeyError("ERR_NO_ACTIVITY", "No activity available or not a ComponentActivity"))
      
      if (credentialManager?.isSupported() != true) {
        return@AsyncFunction promise.reject(PasskeyError("ERR_UNSUPPORTED", "Passkeys are not supported on this device"))
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
      val activity = appContext.currentActivity as? ComponentActivity
        ?: return@AsyncFunction promise.reject(PasskeyError("ERR_NO_ACTIVITY", "No activity available or not a ComponentActivity"))
      
      if (credentialManager?.isSupported() != true) {
        return@AsyncFunction promise.reject(PasskeyError("ERR_UNSUPPORTED", "Passkeys are not supported on this device"))
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