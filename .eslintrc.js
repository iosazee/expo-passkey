module.exports = {
  root: true,
  extends: ["universe/native", "universe/web", "prettier"],
  plugins: ["@typescript-eslint", "prettier", "jest"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  env: {
    node: true,
    es6: true,
  },
  globals: {
    require: "readonly",
    module: "readonly",
    global: "readonly",
    process: "readonly",
    console: "readonly",
  },
  ignorePatterns: [
    "build",
    "**/node_modules/",
    "**/dist/",
    "**/coverage/",
    "**/.git/",
    "**/.DS_Store",
    "**/jest.config.js",
    "**/*.d.ts",
  ],
  rules: {
    "prefer-const": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-var": "error",
    curly: ["error", "all"],
    "no-throw-literal": "error",
    "no-duplicate-imports": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "prettier/prettier": "error",
  },
  overrides: [
    // Test files
    {
      files: ["**/*.test.ts", "**/*.test.js", "**/__tests__/**/*"],
      env: {
        jest: true,
      },
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
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/valid-expect": "error",
      },
    },
    // Jest setup files
    {
      files: ["**/*.setup.js"],
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
      },
      rules: {
        "no-undef": "off",
      },
    },
    // Client code
    {
      files: ["**/client/**/*.ts", "***/client/**/*.js"],
      rules: {
        "no-console": ["warn", { allow: ["warn", "error"] }],
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
  ],
};
