/**
 * @file Diagnostic utilities for debugging passkey issues on iOS and Android
 * @module expo-passkey/client/utils/diagnostics
 *
 * Usage:
 * ```typescript
 * import { runPasskeyDiagnostics } from 'expo-passkey/native';
 * await runPasskeyDiagnostics();
 * ```
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";
import { checkBiometricSupport } from "./biometrics";
import { getDeviceInformation } from "./device";
import { isNativePasskeySupported } from "../native-module";

interface DiagnosticResult {
  platform: string;
  deviceInfo: {
    osVersion: string | undefined;
    modelName: string | null;
    deviceName: string | null;
    bundleId: string | undefined;
  };
  passkeySupport: {
    isSupported: boolean;
    nativeModuleAvailable: boolean;
  };
  biometricInfo: {
    isSupported: boolean;
    isEnrolled: boolean;
    type: string | null;
  };
  configurationChecks: {
    requiredSetup: string[];
    commonIssues: string[];
  };
}

/**
 * Run comprehensive diagnostics for passkey setup
 * Logs detailed information to help debug configuration issues
 */
export async function runPasskeyDiagnostics(): Promise<DiagnosticResult> {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 EXPO PASSKEY DIAGNOSTICS");
  console.log("=".repeat(60) + "\n");

  const result: DiagnosticResult = {
    platform: Platform.OS,
    deviceInfo: {
      osVersion: undefined,
      modelName: null,
      deviceName: null,
      bundleId: undefined,
    },
    passkeySupport: {
      isSupported: false,
      nativeModuleAvailable: false,
    },
    biometricInfo: {
      isSupported: false,
      isEnrolled: false,
      type: null,
    },
    configurationChecks: {
      requiredSetup: [],
      commonIssues: [],
    },
  };

  // Device Information
  console.log("📱 DEVICE INFORMATION");
  console.log("-".repeat(60));
  result.deviceInfo.osVersion = Device.osVersion;
  result.deviceInfo.modelName = Device.modelName;
  result.deviceInfo.deviceName = Device.deviceName;
  result.deviceInfo.bundleId = Application.applicationId;

  console.log(`Platform: ${Platform.OS.toUpperCase()}`);
  console.log(`OS Version: ${Device.osVersion || "Unknown"}`);
  console.log(`Device Model: ${Device.modelName || "Unknown"}`);
  console.log(`Device Name: ${Device.deviceName || "Unknown"}`);
  console.log(`Bundle ID: ${Application.applicationId || "Unknown"}`);
  console.log(`App Version: ${Application.nativeApplicationVersion || "Unknown"}`);
  console.log("");

  // Passkey Support Check
  console.log("🔐 PASSKEY SUPPORT");
  console.log("-".repeat(60));

  try {
    const isSupported = await isNativePasskeySupported();
    result.passkeySupport.isSupported = isSupported;
    result.passkeySupport.nativeModuleAvailable = true;
    console.log(`✅ Native module loaded successfully`);
    console.log(`Passkey Support: ${isSupported ? "✅ YES" : "❌ NO"}`);
  } catch (error) {
    console.error(`❌ Native module error: ${error}`);
    result.passkeySupport.nativeModuleAvailable = false;
  }
  console.log("");

  // Biometric Information
  console.log("👤 BIOMETRIC AUTHENTICATION");
  console.log("-".repeat(60));

  try {
    const biometricInfo = await checkBiometricSupport();
    result.biometricInfo = {
      isSupported: biometricInfo.isSupported,
      isEnrolled: biometricInfo.isEnrolled,
      type: biometricInfo.biometricType || null,
    };

    console.log(`Biometric Type: ${biometricInfo.biometricType || "None"}`);
    console.log(
      `Biometric Available: ${biometricInfo.isSupported ? "✅ YES" : "❌ NO"}`,
    );
    console.log(
      `Biometric Enrolled: ${biometricInfo.isEnrolled ? "✅ YES" : "❌ NO"}`,
    );

    if (!biometricInfo.isSupported) {
      console.log(
        `⚠️  WARNING: Biometric authentication not available on this device`,
      );
    }
    if (!biometricInfo.isEnrolled) {
      console.log(
        `⚠️  WARNING: Biometric authentication not set up. Please enroll Face ID/Touch ID or Fingerprint in device settings.`,
      );
    }
  } catch (error) {
    console.error(`❌ Error checking biometric support: ${error}`);
  }
  console.log("");

  // Device Information from Passkey Module
  console.log("📊 DEVICE DETAILS");
  console.log("-".repeat(60));

  try {
    const deviceInfo = await getDeviceInformation();
    console.log(JSON.stringify(deviceInfo, null, 2));
  } catch (error) {
    console.error(`❌ Error getting device information: ${error}`);
  }
  console.log("");

  // Platform-specific configuration checks
  if (Platform.OS === "ios") {
    console.log("🍎 iOS CONFIGURATION CHECKLIST");
    console.log("-".repeat(60));

    result.configurationChecks.requiredSetup = [
      "iOS 16+ required (Current: " + (Device.osVersion || "Unknown") + ")",
      "Associated Domains configured in app.json",
      "Apple App Site Association (AASA) file accessible",
      "Face ID or Touch ID enrolled on device",
      "Using development or production build (NOT Expo Go)",
    ];

    result.configurationChecks.commonIssues = [
      "Missing associatedDomains in app.json ios section",
      "AASA file not accessible at https://yourdomain.com/.well-known/apple-app-site-association",
      "Domain mismatch between app.json and server rpId",
      "Incorrect Team ID or Bundle ID in AASA file",
      "AASA file not served with correct content-type (application/json)",
      "Face ID/Touch ID not enrolled in device settings",
    ];

    console.log("\n✅ Required Setup:");
    result.configurationChecks.requiredSetup.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item}`);
    });

    console.log("\n❌ Common Issues:");
    result.configurationChecks.commonIssues.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item}`);
    });

    console.log("\n📝 Configuration Steps:");
    console.log("\n1. Add to app.json:");
    console.log('   "ios": {');
    console.log('     "associatedDomains": ["webcredentials:yourdomain.com"]');
    console.log("   }");

    console.log("\n2. Create AASA file at:");
    console.log(
      "   https://yourdomain.com/.well-known/apple-app-site-association",
    );
    console.log("   {");
    console.log('     "webcredentials": {');
    console.log('       "apps": ["TEAMID.com.yourcompany.yourapp"]');
    console.log("     }");
    console.log("   }");

    console.log("\n3. Configure server:");
    console.log("   expoPasskey({");
    console.log('     rpId: "yourdomain.com",');
    console.log('     origin: ["https://yourdomain.com"]');
    console.log("   })");

    console.log("\n4. Rebuild app:");
    console.log("   npx expo prebuild");
    console.log("   npx expo run:ios");

    // Check iOS version
    const osVersion = Device.osVersion;
    if (osVersion) {
      const majorVersion = parseInt(osVersion.split(".")[0], 10);
      if (majorVersion < 16) {
        console.log(
          `\n⚠️  WARNING: iOS ${osVersion} detected. iOS 16+ is required for passkeys.`,
        );
      } else {
        console.log(`\n✅ iOS ${osVersion} meets minimum requirements.`);
      }
    }
  } else if (Platform.OS === "android") {
    console.log("🤖 ANDROID CONFIGURATION CHECKLIST");
    console.log("-".repeat(60));

    result.configurationChecks.requiredSetup = [
      "Android 10+ (API 29+) required",
      "Asset Links JSON file configured",
      "Fingerprint or Face Recognition enrolled",
      "Using development or production build (NOT Expo Go)",
    ];

    result.configurationChecks.commonIssues = [
      "Missing assetlinks.json file at https://yourdomain.com/.well-known/assetlinks.json",
      "Incorrect SHA-256 fingerprint in assetlinks.json",
      "Domain mismatch between assetlinks.json and server rpId",
      "Fingerprint/Face not enrolled in device settings",
      "Incorrect android:apk-key-hash format in server origin",
    ];

    console.log("\n✅ Required Setup:");
    result.configurationChecks.requiredSetup.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item}`);
    });

    console.log("\n❌ Common Issues:");
    result.configurationChecks.commonIssues.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item}`);
    });

    console.log("\n📝 Configuration Steps:");
    console.log(
      "\n1. Create Asset Links file at:\n   https://yourdomain.com/.well-known/assetlinks.json",
    );
    console.log("\n2. Get SHA-256 fingerprint and convert to base64url");
    console.log("\n3. Add android origin to server:");
    console.log("   origin: [");
    console.log('     "https://yourdomain.com",');
    console.log('     "android:apk-key-hash:<your-base64url-hash>"');
    console.log("   ]");
  }

  console.log("\n" + "=".repeat(60));
  console.log("🔗 HELPFUL RESOURCES");
  console.log("-".repeat(60));
  console.log(
    "Documentation: https://github.com/iosazee/expo-passkey#readme",
  );
  console.log("Example Project: https://github.com/iosazee/neb-starter");

  if (Platform.OS === "ios") {
    console.log(
      "AASA Validator: https://search.developer.apple.com/appsearch-validation-tool/",
    );
    console.log(
      "Associated Domains: https://developer.apple.com/documentation/xcode/supporting-associated-domains",
    );
  } else if (Platform.OS === "android") {
    console.log(
      "Asset Links Generator: https://developers.google.com/digital-asset-links/tools/generator",
    );
    console.log(
      "Asset Links Guide: https://developers.google.com/digital-asset-links",
    );
  }

  console.log("=".repeat(60) + "\n");

  return result;
}

/**
 * Quick check if passkey is ready to use
 * Returns true only if all requirements are met
 */
export async function isPasskeyReady(): Promise<{
  ready: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const isSupported = await isNativePasskeySupported();
    if (!isSupported) {
      issues.push("Passkey not supported on this device");
    }
  } catch (error) {
    issues.push("Native module not available");
    return { ready: false, issues };
  }

  try {
    const biometricInfo = await checkBiometricSupport();
    if (!biometricInfo.isSupported) {
      issues.push("Biometric authentication not available");
    }
    if (!biometricInfo.isEnrolled) {
      issues.push("Biometric authentication not enrolled");
    }
  } catch (error) {
    issues.push("Error checking biometric support");
  }

  if (Platform.OS === "ios") {
    const osVersion = Device.osVersion;
    if (osVersion) {
      const majorVersion = parseInt(osVersion.split(".")[0], 10);
      if (majorVersion < 16) {
        issues.push(`iOS ${osVersion} detected. iOS 16+ required.`);
      }
    }
  } else if (Platform.OS === "android") {
    // Android API level check would go here if available
    // This would require additional native module methods
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}
