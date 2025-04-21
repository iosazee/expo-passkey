import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jestPlugin from "eslint-plugin-jest";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default defineConfig([
  // Global ignores
  globalIgnores([
    "**/node_modules/",
    "**/dist/",
    "**/coverage/",
    "**/.git/",
    "**/.DS_Store",
    "**/jest.config.js",
    "**/*.d.ts",
  ]),

 // Base configuration for JS
{
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        require: "readonly",
        module: "readonly",
        global: "readonly",
        process: "readonly",
        console: "readonly",
      }
    },
    rules: {
      "prefer-const": "error",
      "eqeqeq": ["error", "always", { "null": "ignore" }],
      "no-var": "error",
      "curly": ["error", "all"],
      "no-throw-literal": "error",
      "no-duplicate-imports": "error",
    },
  },
  
  // TypeScript config
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "prettier": prettierPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_", 
      }],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
  
      "prettier/prettier": "error",
    },
  },
  

  // Jest test files
  {
    files: ["**/*.test.ts", "**/*.test.js", "**/__tests__/**/*"],
    plugins: {
      "jest": jestPlugin,
    },
    languageOptions: {
      globals: {
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        fail: "readonly",
      }
    },
    rules: {
      // Relaxed TypeScript rules for tests
      "@typescript-eslint/no-explicit-any": "off",
      
      // Jest specific rules
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
      "jest/no-identical-title": "error",
      "jest/valid-expect": "error",
    },
  },

  // Jest setup files
  {
    files: ["**/*.setup.js"],
    languageOptions: {
      globals: {
        jest: "readonly",
        require: "readonly",
        global: "readonly",
        process: "readonly",
        console: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      }
    },
    rules: {
      "no-undef": "off",
    }
  },

  // Special handling for console.log in client code
  {
    files: ["**/client/**/*.ts", "**/client/**/*.js"],
    rules: {
      "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
    },
  },

  // Configuration files
  {
    files: ["*.config.js", "*.config.ts", "tsup.config.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  

  prettierConfig,
]);