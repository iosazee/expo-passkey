/**
 * This script checks if @simplewebauthn/server is installed when used in a server environment.
 * It's designed to work in both ESM and CommonJS environments.
 */

// Using CommonJS modules for wider compatibility
const fs = require("fs");
const path = require("path");

// Function to check if we're in an Expo/React Native project
function isClientEnvironment() {
  try {
    // Check for common React Native/Expo files in the project
    const possibleClientFiles = [
      "app.json",
      "metro.config.js",
      "App.tsx",
      "App.jsx",
      "app/_layout.tsx",
    ];

    // Get the project root (outside node_modules)
    let projectRoot = process.cwd();
    if (projectRoot.includes("node_modules")) {
      projectRoot = projectRoot.split("node_modules")[0];
    }

    // Check if any of the client-specific files exist
    const hasClientFiles = possibleClientFiles.some((file) =>
      fs.existsSync(path.join(projectRoot, file)),
    );

    // Also check for expo/react-native in package.json dependencies
    let hasClientDeps = false;
    try {
      const packageJsonPath = path.join(projectRoot, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        };

        hasClientDeps = Object.keys(allDeps).some(
          (dep) => dep === "expo" || dep === "react-native",
        );
      }
    } catch (e) {
      // Silently fail package.json check
    }

    return (
      hasClientFiles ||
      hasClientDeps ||
      // Also check env variables as a fallback
      process.env.EXPO_PUBLIC_RUNTIME === "client" ||
      process.env.REACT_NATIVE_ENV === "true" ||
      process.env.REACT_NATIVE === "true"
    );
  } catch (e) {
    // If any error occurs during detection, assume it's not a client environment
    return false;
  }
}

// Check if we're in the package's own directory
const isOwnPackage = (() => {
  try {
    // Check package name
    if (process.env.npm_package_name === "expo-passkey") {
      return true;
    }

    // Check if we're in the actual expo-passkey directory
    const currentDir = process.cwd();
    if (currentDir.includes("expo-passkey")) {
      const packageJsonPath = path.join(currentDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageData = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        return packageData.name === "expo-passkey";
      }
    }
    return false;
  } catch (e) {
    return false;
  }
})();

// Skip the check if we're in the package's own directory or a client-only environment
if (!isOwnPackage && !isClientEnvironment()) {
  try {
    require.resolve("@simplewebauthn/server");
    // ✅ Server dependency found, all good
    console.log(
      "\x1b[32m%s\x1b[0m",
      "[expo-passkey] Server dependency found: @simplewebauthn/server ✓",
    );
  } catch (e) {
    // Determine package manager for a helpful message
    const userAgent = process.env.npm_config_user_agent || "";
    const isYarn = userAgent.includes("yarn");
    const isPnpm = userAgent.includes("pnpm");

    let installCmd = "npm install @simplewebauthn/server";
    if (isYarn) installCmd = "yarn add @simplewebauthn/server";
    else if (isPnpm) installCmd = "pnpm add @simplewebauthn/server";

    // Display warning
    console.warn(
      "\x1b[33m%s\x1b[0m", // Yellow
      `┌─────────────────────────────────────────────────────┐
│ [expo-passkey] Server dependency missing!           │
│                                                     │
│ The server component requires:                      │
│   ${installCmd.padEnd(45)}│
│                                                     │
│ If you're only using client features, you can       │
│ safely ignore this warning.                         │
└─────────────────────────────────────────────────────┘`,
    );
  }
}
