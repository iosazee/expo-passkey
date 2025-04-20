// Check if we are in the package's own directory
const isOwnPackage =
  process.env.npm_package_name === "expo-passkey" ||
  process.env.npm_config_argv?.includes("run prepare");

const isClientOnlyEnv =
  process.env.EXPO_PUBLIC_RUNTIME === "client" ||
  process.env.REACT_NATIVE_ENV === "true" ||
  process.env.REACT_NATIVE === "true";

// Skip the check if we're in the package's own directory or a client-only environment
if (!isOwnPackage && !isClientOnlyEnv) {
  try {
    require.resolve("@simplewebauthn/server");
    // ✅ Server dependency found, all good
  } catch {
    const userAgent = process.env.npm_config_user_agent || "";
    const isYarn = userAgent.includes("yarn");
    const isPnpm = userAgent.includes("pnpm");

    let installCmd = "npm install @simplewebauthn/server";
    if (isYarn) installCmd = "yarn add @simplewebauthn/server";
    else if (isPnpm) installCmd = "pnpm add @simplewebauthn/server";

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
