#!/usr/bin/env node
/**
 * This script checks if @simplewebauthn/server is installed when used in a server environment.
 * Special handling for modern fullstack frameworks (NextJS, Remix, SvelteKit, etc.)
 */

const fs = require("fs");
const path = require("path");

// Enable debug mode with PASSKEY_DEBUG=1
const DEBUG = process.env.PASSKEY_DEBUG === "1";

// Allow direct configuration with PASSKEY_CHECK_SERVER=0 to disable or PASSKEY_CHECK_SERVER=1 to force
const FORCE_CHECK = process.env.PASSKEY_CHECK_SERVER === "1";
const SKIP_CHECK = process.env.PASSKEY_CHECK_SERVER === "0";

function debug(...args) {
  if (DEBUG) {
    console.log("\x1b[36m[DEBUG]\x1b[0m", ...args);
  }
}

debug("Starting check-server-deps.cjs script");
debug("Current working directory:", process.cwd());

// Check if we're in the package's own directory
function isOwnPackageDirectory() {
  try {
    // Check package name from env var
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
        if (packageData.name === "expo-passkey") {
          return true;
        }
      }
    }
    return false;
  } catch (e) {
    debug("Error in isOwnPackageDirectory:", e);
    return false;
  }
}

// Check if this is a pure client environment (no server components)
function isPureClientEnvironment() {
  if (SKIP_CHECK) {
    debug("Skipping check due to PASSKEY_CHECK_SERVER=0");
    return true; // Skip check
  }

  if (FORCE_CHECK) {
    debug("Forcing check due to PASSKEY_CHECK_SERVER=1");
    return false; // Force check
  }

  try {
    // Get the project root (outside node_modules)
    let projectRoot = process.cwd();
    if (projectRoot.includes("node_modules")) {
      projectRoot = projectRoot.split("node_modules")[0];
    }

    debug("Project root directory:", projectRoot);

    // Check for package.json
    const packageJsonPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      // Define known server/fullstack frameworks
      const serverFrameworks = [
        "next", // NextJS
        "express", // Express
        "fastify", // Fastify
        "koa", // Koa
        "nestjs", // NestJS
        "@remix-run/node", // Remix
        "@remix-run/express", // Remix with Express
        "@sveltejs/kit", // SvelteKit
        "vite-plugin-ssr", // Vite SSR plugin
        "vite-plugin-pwa", // Vite PWA plugin (often server-rendered)
        "@astrojs/node", // Astro with Node adapter
        "@tanstack/react-router", // TanStack Router (can be used server-side)
        "nuxt", // Nuxt.js
        "gatsby", // Gatsby
        "h3", // h3 (Nitro/Nuxt runtime)
        "nitro", // Nitro
        "solid-start", // SolidStart
        "sveltekit-adapter-node", // SvelteKit node adapter
        "astro-node-adapter", // Astro node adapter
        "hono", // Hono framework
      ];

      // Check for meta frameworks
      const hasServerFramework = serverFrameworks.some(
        (framework) => !!allDeps[framework],
      );

      // Check for vite or other bundlers with SSR configurations
      const hasVite = !!allDeps["vite"];
      const hasViteConfig =
        fs.existsSync(path.join(projectRoot, "vite.config.js")) ||
        fs.existsSync(path.join(projectRoot, "vite.config.ts"));

      // If we detect a fullstack framework, it needs server deps
      if (hasServerFramework) {
        const detected = serverFrameworks.filter((f) => !!allDeps[f]);
        debug(`Fullstack framework detected: ${detected.join(", ")}`);
        return false; // Needs server deps
      }

      // If project has Vite, check if it's likely a server-rendered app
      if (hasVite && hasViteConfig) {
        debug("Vite detected, checking for server rendering configuration");

        // Try to read Vite config to check for SSR settings
        try {
          const viteConfigPath = fs.existsSync(
            path.join(projectRoot, "vite.config.ts"),
          )
            ? path.join(projectRoot, "vite.config.ts")
            : path.join(projectRoot, "vite.config.js");

          if (fs.existsSync(viteConfigPath)) {
            const viteConfig = fs.readFileSync(viteConfigPath, "utf8");
            // Look for SSR configuration indications
            if (
              viteConfig.includes("ssr") ||
              viteConfig.includes("server") ||
              viteConfig.includes("prerender")
            ) {
              debug("Server rendering detected in Vite config");
              return false; // Likely a server component, needs server deps
            }
          }
        } catch (e) {
          debug("Error reading Vite config:", e);
          // Continue with other checks
        }
      }

      // Check for only client-side frameworks
      const isReactNative = !!allDeps["react-native"] || !!allDeps["expo"];

      // If it's React Native without server frameworks, it's a pure client env
      if (isReactNative && !hasServerFramework) {
        debug("Pure React Native/Expo environment detected");
        return true;
      }
    }

    // Check for framework-specific server files
    const serverDirectories = [
      "pages/api", // Next.js API routes
      "app/api", // Next.js App Router API routes
      "api", // Common API directory
      "server", // Common server directory
      "backend", // Common backend directory
      "app/routes", // Remix routes
      "app/actions", // Remix/Next.js server actions
      "src/routes", // SvelteKit routes
      "functions", // Serverless functions
      "src/server", // Common server code directory
      "src/api", // Common API directory
    ];

    const serverFiles = [
      "next.config.js", // Next.js
      "next.config.mjs", // Next.js (ESM)
      "remix.config.js", // Remix
      "svelte.config.js", // SvelteKit
      "server.js", // Generic server
      "server.ts", // Generic server
      "api.js", // Generic API
      "api.ts", // Generic API
      "astro.config.mjs", // Astro
      "nuxt.config.js", // Nuxt
      "nuxt.config.ts", // Nuxt
      "netlify.toml", // Netlify (often with serverless functions)
      "vercel.json", // Vercel (often with serverless functions)
    ];

    // Check for React Native/Expo files
    const reactNativeFiles = [
      "app.json", // Expo
      "metro.config.js", // React Native
      "App.tsx", // React Native
      "App.jsx", // React Native
      "app/_layout.tsx", // Expo Router
    ];

    // Check if any server directories exist
    const hasServerDirs = serverDirectories.some((dir) => {
      const dirPath = path.join(projectRoot, dir);
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    });

    // Check if any server files exist
    const hasServerFilesFlag = serverFiles.some((file) => {
      return fs.existsSync(path.join(projectRoot, file));
    });

    // Check if any React Native files exist
    const hasReactNativeFiles = reactNativeFiles.some((file) =>
      fs.existsSync(path.join(projectRoot, file)),
    );

    debug("File detection:", {
      hasServerDirs,
      hasServerFilesFlag,
      hasReactNativeFiles,
    });

    // If it has server directories or files, it's a server environment
    if (hasServerDirs || hasServerFilesFlag) {
      return false; // Needs server deps
    }

    // If it has React Native files but no server files, it's a pure client env
    if (hasReactNativeFiles) {
      return true;
    }

    // Default to assuming it needs server deps if we can't determine otherwise
    return false;
  } catch (e) {
    debug("Error in isPureClientEnvironment:", e);
    return false;
  }
}

// Check if dependency is specifically installed in this project's node_modules
function isDepInstalledLocally(depName) {
  try {
    // Get the project root (outside node_modules)
    let projectRoot = process.cwd();
    if (projectRoot.includes("node_modules")) {
      projectRoot = projectRoot.split("node_modules")[0];
    }

    // Check if node_modules/@simplewebauthn/server exists in this directory
    const depPath = path.join(projectRoot, "node_modules", depName);
    const exists = fs.existsSync(depPath);
    debug(
      `Checking if ${depName} is installed locally in ${depPath}: ${exists}`,
    );
    return exists;
  } catch (e) {
    debug(`Error checking if ${depName} is installed:`, e);
    return false;
  }
}

// Main logic
const isOwnPackage = isOwnPackageDirectory();
const pureClientEnv = isPureClientEnvironment();

// Skip the check only if we're in our own package or it's a pure client environment
if (!isOwnPackage && !pureClientEnv) {
  debug("Not skipping check - proceeding to verify @simplewebauthn/server");

  // Check if the server dependency is installed locally in this project
  if (isDepInstalledLocally("@simplewebauthn/server")) {
    debug("@simplewebauthn/server found in local node_modules");
    console.log(
      "\x1b[32m%s\x1b[0m",
      "[expo-passkey] Server dependency found: @simplewebauthn/server ✓",
    );
  } else {
    debug("@simplewebauthn/server not found in local node_modules");

    // Determine package manager for a helpful message
    const userAgent = process.env.npm_config_user_agent || "";
    const isYarn = userAgent.includes("yarn");
    const isPnpm = userAgent.includes("pnpm");

    let installCmd = "npm install @simplewebauthn/server";
    if (isYarn) installCmd = "yarn add @simplewebauthn/server";
    else if (isPnpm) installCmd = "pnpm add @simplewebauthn/server";

    // IMPORTANT: Using console.log instead of console.warn so it appears in stdout
    // for easier test capture. The color is still yellow to indicate a warning.
    console.log(
      "\x1b[33m%s\x1b[0m", // Yellow
      `┌─────────────────────────────────────────────────────┐
│ [expo-passkey] Server dependency missing!           │
│                                                     │
│ The server component requires:                      │
│   ${installCmd.padEnd(45)}│
│                                                     │
│ This dependency is needed for fullstack frameworks  │
│ like Next.js, Remix, SvelteKit and others.          │
└─────────────────────────────────────────────────────┘`,
    );
  }
} else {
  debug(
    "Skipping @simplewebauthn/server check:",
    isOwnPackage
      ? "Running in own package"
      : "Pure client environment detected",
  );
}
