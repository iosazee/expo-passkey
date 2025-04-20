export default {
  projects: [
    // Root project for main package tests
    {
      displayName: 'root',
      testMatch: [
        '<rootDir>/src/__tests__/**/*.test.ts',
      ],
      preset: 'jest-expo',
      testEnvironment: 'node',
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-modules-core)',
      ],
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/src/$1',
      },
      coveragePathIgnorePatterns: [
        '/__tests__/',
        '/node_modules/',
        '/types\\.ts$'
      ],
      setupFiles: ['<rootDir>/src/client/__tests__/jest.client.setup.js'],
    },

    // Client tests configuration
    {
      displayName: 'client',
      testMatch: [
        '<rootDir>/src/client/**/__tests__/**/*.test.ts',
        '<rootDir>/src/utils/**/__tests__/**/*.test.ts',
      ],
      preset: 'jest-expo',
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|expo-modules-core)',
      ],
      setupFilesAfterEnv: ['<rootDir>/src/client/__tests__/jest.client.setup.js'],
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/src/$1',
      },
      coveragePathIgnorePatterns: [
        '/__tests__/',
        '/node_modules/',
        '/types\\.ts$'
      ],
    },

    // Server tests configuration
    {
      displayName: 'server',
      testMatch: ['<rootDir>/src/server/**/__tests__/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/server/__tests__/jest.server.setup.js'],
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/src/$1',
      },
      coveragePathIgnorePatterns: [
        '/__tests__/',
        '/node_modules/',
        '/types\\.ts$'
      ],
    },
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}", 
    "!src/**/*.d.ts", 
    "!src/**/__tests__/**/*",
    "!**/node_modules/**"
  ],
  coverageProvider: "v8",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "ts-jest"
  },
  cache: false,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
};