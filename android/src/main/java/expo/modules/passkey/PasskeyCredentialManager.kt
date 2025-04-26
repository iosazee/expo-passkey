package expo.modules.passkey

import android.content.Context
import android.os.Build
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.credentials.CredentialManager
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.exceptions.*
import androidx.credentials.exceptions.publickeycredential.CreatePublicKeyCredentialDomException
import androidx.credentials.exceptions.publickeycredential.GetPublicKeyCredentialDomException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * Helper class to manage WebAuthn credential operations on Android
 * This class handles the interaction with the Android Credentials API for WebAuthn operations
 */
class PasskeyCredentialManager(private val context: Context) {
    private val TAG = "PasskeyCredentialManager"
    private var credentialManager: CredentialManager? = null

    init {
        if (isSupported()) {
            try {
                credentialManager = CredentialManager.create(context)
                Log.d(TAG, "CredentialManager initialized successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize CredentialManager: ${e.message}")
            }
        } else {
            Log.w(TAG, "WebAuthn not supported on this device (API level: ${Build.VERSION.SDK_INT})")
        }
    }

    /**
     * Check if passkeys are supported on this device
     * @return true if passkeys are supported on this device
     */
    fun isSupported(): Boolean {
        // According to Google's documentation, passkeys are supported on Android 9+ (API level 28+)
        Log.d(TAG, "Checking passkey support - Android API level: ${Build.VERSION.SDK_INT}")
        
        // Android 14+ (API 34+) should always be supported
        if (Build.VERSION.SDK_INT >= 34) {
            Log.d(TAG, "Android 14+ detected, passkeys are supported")
            return true
        }
        
        // Android 9-13 (API 28-33) requires additional checks
        if (Build.VERSION.SDK_INT >= 28) {
            // Check if the credential manager can be initialized
            try {
                if (credentialManager != null || CredentialManager.create(context) != null) {
                    Log.d(TAG, "CredentialManager initialized successfully")
                    
                    // Check if the device has necessary hardware features
                    val packageManager = context.packageManager
                    val hasBiometric = packageManager.hasSystemFeature("android.hardware.biometrics")
                    val hasFingerprint = packageManager.hasSystemFeature("android.hardware.fingerprint")
                    
                    Log.d(TAG, "Biometric support: $hasBiometric, Fingerprint support: $hasFingerprint")
                    
                    // If any biometric capability is available, consider it supported
                    if (hasBiometric || hasFingerprint) {
                        return true
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking credential manager support: ${e.message}")
            }
        }
        
        // If we get here, passkeys are not supported
        Log.d(TAG, "Passkeys not supported on this device")
        return false
    }

    /**
     * Create a new passkey
     * @param activity The current activity
     * @param requestJson The WebAuthn request JSON
     * @return The WebAuthn registration response as a JSONObject
     */
    suspend fun createPasskey(
        activity: ComponentActivity,
        requestJson: String
    ): JSONObject = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Starting passkey creation")
            val manager = credentialManager ?: throw Exception("CredentialManager not initialized")
            
            val request = CreatePublicKeyCredentialRequest(requestJson)
            val result = withContext(Dispatchers.Main) {
                // Credential operations must be run on the main thread
                manager.createCredential(activity, request)
            }
            
            // Extract the response JSON
            val credential = result.credential
            if (credential is androidx.credentials.PublicKeyCredential) {
                Log.d(TAG, "Passkey created successfully")
                return@withContext JSONObject(credential.registrationResponseJson)
            } else {
                throw Exception("Invalid credential type returned: ${credential.javaClass.simpleName}")
            }
        } catch (e: CreateCredentialException) {
            handleCreateCredentialException(e)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating passkey: ${e.message}")
            throw Exception("Failed to create passkey: ${e.message}")
        }
    }

    /**
     * Authenticate with an existing passkey
     * @param activity The current activity
     * @param requestJson The WebAuthn request JSON
     * @return The WebAuthn authentication response as a JSONObject
     */
    suspend fun authenticateWithPasskey(
        activity: ComponentActivity,
        requestJson: String
    ): JSONObject = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Starting passkey authentication")
            val manager = credentialManager ?: throw Exception("CredentialManager not initialized")
            
            val getPublicKeyCredentialOption = GetPublicKeyCredentialOption(requestJson)
            val request = GetCredentialRequest(listOf(getPublicKeyCredentialOption))
            
            val result = withContext(Dispatchers.Main) {
                // Credential operations must be run on the main thread
                manager.getCredential(activity, request)
            }
            
            // Extract the response JSON
            val credential = result.credential
            if (credential is androidx.credentials.PublicKeyCredential) {
                Log.d(TAG, "Passkey authentication successful")
                return@withContext JSONObject(credential.authenticationResponseJson)
            } else {
                throw Exception("Invalid credential type returned: ${credential.javaClass.simpleName}")
            }
        } catch (e: GetCredentialException) {
            handleGetCredentialException(e)
        } catch (e: Exception) {
            Log.e(TAG, "Error authenticating with passkey: ${e.message}")
            throw Exception("Failed to authenticate with passkey: ${e.message}")
        }
    }

    /**
     * Handle exceptions from createCredential
     * @param e The exception to handle
     * @throws Exception with a user-friendly message
     */
    private fun handleCreateCredentialException(e: CreateCredentialException): Nothing {
        when (e) {
            is CreatePublicKeyCredentialDomException -> {
                Log.e(TAG, "WebAuthn DOM error: ${e.domError}")
                throw Exception("WebAuthn error: ${e.domError}")
            }
            is CreateCredentialCancellationException -> {
                Log.d(TAG, "User canceled the operation")
                throw Exception("Canceled by user")
            }
            is CreateCredentialInterruptedException -> {
                Log.w(TAG, "Operation was interrupted")
                throw Exception("Operation interrupted")
            }
            is CreateCredentialProviderConfigurationException -> {
                Log.e(TAG, "Missing provider configuration dependency")
                throw Exception("Missing provider configuration. Make sure credentials-play-services-auth is included in your dependencies.")
            }
            is CreateCredentialUnsupportedException -> {
                Log.e(TAG, "This operation is not supported")
                throw Exception("Passkeys not supported on this device")
            }
            else -> {
                Log.e(TAG, "Failed to create credential: ${e.message}")
                throw Exception("Failed to create credential: ${e.message}")
            }
        }
    }

    /**
     * Handle exceptions from getCredential
     * @param e The exception to handle
     * @throws Exception with a user-friendly message
     */
    private fun handleGetCredentialException(e: GetCredentialException): Nothing {
        when (e) {
            is GetPublicKeyCredentialDomException -> {
                Log.e(TAG, "WebAuthn DOM error: ${e.domError}")
                throw Exception("WebAuthn error: ${e.domError}")
            }
            is GetCredentialCancellationException -> {
                Log.d(TAG, "User canceled the operation")
                throw Exception("Canceled by user")
            }
            is GetCredentialInterruptedException -> {
                Log.w(TAG, "Operation was interrupted")
                throw Exception("Operation interrupted")
            }
            is GetCredentialProviderConfigurationException -> {
                Log.e(TAG, "Missing provider configuration dependency")
                throw Exception("Missing provider configuration. Make sure credentials-play-services-auth is included in your dependencies.")
            }
            is GetCredentialUnsupportedException -> {
                Log.e(TAG, "This operation is not supported")
                throw Exception("Passkeys not supported on this device")
            }
            is NoCredentialException -> {
                Log.w(TAG, "No credential available for this request")
                throw Exception("No passkey found")
            }
            else -> {
                Log.e(TAG, "Failed to get credential: ${e.message}")
                throw Exception("Failed to authenticate: ${e.message}")
            }
        }
    }
}