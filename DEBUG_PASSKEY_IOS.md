# iOS Passkey Debugging Guide

## Error: "Failed to create passkey: The passkey request failed"

This error occurs when iOS's AuthenticationServices framework cannot complete the passkey request, usually due to configuration issues.

## Quick Diagnosis Checklist

### ✅ Step 1: Verify Build Type
- [ ] Using development build or production build (NOT Expo Go)
- [ ] Run: `npx expo prebuild && npx expo run:ios`

### ✅ Step 2: Check iOS Requirements
- [ ] iOS 16+ device or simulator
- [ ] Face ID/Touch ID is enrolled
  - Simulator: Features → Face ID/Touch ID → Enrolled
  - Device: Settings → Face ID & Passcode (or Touch ID & Passcode)

### ✅ Step 3: Verify Associated Domains

Check your `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "associatedDomains": [
        "webcredentials:yourdomain.com"
      ]
    }
  }
}
```

**Important Notes:**
- Use `webcredentials:` prefix (NOT `applinks:`)
- No `https://` in the domain
- No trailing slashes

After `expo prebuild`, verify in `ios/YourApp/YourApp.entitlements`:
```bash
cat ios/*/YourApp.entitlements | grep -A 5 "associated-domains"
```

### ✅ Step 4: Verify Apple App Site Association (AASA) File

**Test accessibility:**
```bash
curl -I https://yourdomain.com/.well-known/apple-app-site-association
```

Should return:
- HTTP status: 200
- Content-Type: application/json

**Download and verify:**
```bash
curl https://yourdomain.com/.well-known/apple-app-site-association | jq
```

**Correct format:**
```json
{
  "webcredentials": {
    "apps": [
      "TEAMID.com.yourcompany.yourapp"
    ]
  }
}
```

**Find your Team ID:**
- Apple Developer Portal → Membership → Team ID
- Or in Xcode → Project Settings → Signing & Capabilities

**Common AASA Issues:**
- [ ] File is accessible over HTTPS (required)
- [ ] No `.json` extension (must be `apple-app-site-association` without extension)
- [ ] Correct Team ID format
- [ ] Correct Bundle ID
- [ ] Content-Type header is `application/json`
- [ ] File is in the `.well-known` directory
- [ ] No redirect issues (301/302)

**Test with Apple's validator:**
https://search.developer.apple.com/appsearch-validation-tool/

### ✅ Step 5: Verify Server Configuration

Check your Better Auth server setup:
```typescript
expoPasskey({
  rpId: "yourdomain.com",  // Must match domain in associatedDomains (without https://)
  rpName: "Your App Name",
  origin: [
    "https://yourdomain.com"  // Include https:// here
  ]
})
```

**Important:**
- `rpId` should be just the domain (no protocol, no port)
- `origin` should include the full URL with protocol
- Domain must match your `associatedDomains` in app.json

### ✅ Step 6: Check Xcode Console Logs

1. Open Xcode
2. Window → Devices and Simulators
3. Select your device/simulator
4. Click "Open Console"
5. Run your app and attempt passkey creation
6. Look for logs with `[ExpoPasskey]` prefix

**Key log entries to look for:**
```
[ExpoPasskey] Authentication failed with error: ...
[ExpoPasskey] ASAuthorizationError code: ...
[ExpoPasskey] Common causes: ...
```

### ✅ Step 7: Verify Pods Installation

```bash
cd ios
pod install --repo-update
cd ..
npx expo run:ios
```

## Common Solutions

### Solution 1: Development Domain (For Testing)

If you're testing locally without a production domain:

1. **Use a test domain you control** (not localhost)
2. **Set up AASA file** on a public server
3. **Point to that domain** in your app.json and server config

**Note:** localhost and IP addresses won't work with Associated Domains.

### Solution 2: Simulator vs Real Device

**Simulator issues:**
- Ensure Face ID is enrolled: Features → Face ID → Enrolled
- When prompted, select "Matching Face" to simulate successful biometric

**Real device issues:**
- Verify biometrics are set up in device Settings
- Ensure device is iOS 16+
- Check device is signed in to iCloud (for iCloud Keychain sync)

### Solution 3: Clean Build

Sometimes Xcode caching can cause issues:

```bash
# Clean all builds
cd ios
rm -rf build
pod deintegrate
pod install
cd ..

# Clean Expo cache
npx expo start -c

# Rebuild
npx expo run:ios
```

### Solution 4: Check Provisioning Profile

For development builds:
1. Xcode → Project → Signing & Capabilities
2. Verify "Associated Domains" capability is present
3. Verify your Team is selected
4. Let Xcode manage signing automatically

## Debugging Script

Add this to your app to log diagnostic information:

```typescript
// DiagnosticScreen.tsx
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import {
  isPasskeySupported,
  getBiometricInfo,
  getDeviceInfo
} from 'expo-passkey/native';

export async function logDiagnostics() {
  if (Platform.OS !== 'ios') {
    console.log('This diagnostic is for iOS only');
    return;
  }

  console.log('=== Expo Passkey iOS Diagnostics ===');

  // Device info
  console.log('\n--- Device Information ---');
  console.log('iOS Version:', Device.osVersion);
  console.log('Device Model:', Device.modelName);
  console.log('Device Name:', Device.deviceName);
  console.log('Bundle ID:', Application.applicationId);

  // Passkey support
  console.log('\n--- Passkey Support ---');
  const isSupported = await isPasskeySupported();
  console.log('Passkey Supported:', isSupported);

  // Biometric info
  try {
    const biometricInfo = await getBiometricInfo();
    console.log('Biometric Type:', biometricInfo.type);
    console.log('Biometric Enrolled:', biometricInfo.isEnrolled);
    console.log('Biometric Available:', biometricInfo.isSupported);
  } catch (error) {
    console.error('Error getting biometric info:', error);
  }

  // Device info from passkey module
  try {
    const deviceInfo = await getDeviceInfo();
    console.log('Device Info:', JSON.stringify(deviceInfo, null, 2));
  } catch (error) {
    console.error('Error getting device info:', error);
  }

  console.log('\n--- Configuration Checklist ---');
  console.log('1. Check app.json for associatedDomains');
  console.log('2. Verify AASA file at: https://yourdomain.com/.well-known/apple-app-site-association');
  console.log('3. Ensure rpId matches domain in server config');
  console.log('4. Check Xcode console logs for [ExpoPasskey] entries');
  console.log('===================================');
}

// Call this function when debugging
logDiagnostics();
```

## Still Having Issues?

1. **Check Xcode console logs** - They now include detailed diagnostic information
2. **Verify domain ownership** - You must control the domain for Associated Domains
3. **Test with Apple's validator** - Use the validation tool linked above
4. **Check server logs** - Ensure challenges are being generated correctly
5. **Review the example project** - https://github.com/iosazee/neb-starter

## Reference Links

- [Apple Associated Domains Documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
- [Apple App Site Association Validator](https://search.developer.apple.com/appsearch-validation-tool/)
- [Expo Passkey README](https://github.com/iosazee/expo-passkey#readme)
- [WebAuthn Guide](https://webauthn.guide/)
- [Neb Starter Example](https://github.com/iosazee/neb-starter)

## Common Error Patterns

### Pattern 1: "The passkey request failed" immediately
→ Usually Associated Domains / AASA file issue

### Pattern 2: Biometric prompt appears then fails
→ Usually server configuration or domain mismatch

### Pattern 3: No biometric prompt at all
→ Face ID/Touch ID not enrolled or iOS version too old

### Pattern 4: Works on one device but not another
→ Device-specific biometric setup or iOS version differences
