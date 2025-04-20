const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Track all intervals created during tests
const originalSetInterval = global.setInterval;
const intervals = new Set();

// Override setInterval to track all created intervals
global.setInterval = function (handler, timeout, ...args) {
  const id = originalSetInterval(handler, timeout, ...args);
  intervals.add(id);
  return id;
};

// Mock these modules that should never be used in server tests
jest.mock("react-native", () => {
  throw new Error("react-native should not be imported in server-side code");
});

jest.mock("expo", () => {
  throw new Error("expo should not be imported in server-side code");
});

jest.mock("expo-application", () => {
  throw new Error(
    "expo-application should not be imported in server-side code",
  );
});

jest.mock("expo-device", () => {
  throw new Error("expo-device should not be imported in server-side code");
});

jest.mock("expo-local-authentication", () => {
  throw new Error(
    "expo-local-authentication should not be imported in server-side code",
  );
});

jest.mock("expo-secure-store", () => {
  throw new Error(
    "expo-secure-store should not be imported in server-side code",
  );
});

jest.mock("expo-crypto", () => {
  throw new Error("expo-crypto should not be imported in server-side code");
});

// Mock Better Auth components needed for server tests
jest.mock("better-auth/api", () => ({
  createAuthEndpoint: jest.fn((path, options, handler) => ({
    path,
    options,
    handler,
  })),
  sessionMiddleware: jest.fn(() => ({})),
  setSessionCookie: jest.fn(),
  setCookieCache: jest.fn(),
}));

jest.mock("better-call", () => ({
  APIError: class APIError extends Error {
    constructor(status, data) {
      super(data.message || "API Error");
      this.status = status;
      this.data = data;
    }
  },
}));

// Clear all tracked intervals after each test
afterEach(() => {
  intervals.forEach((id) => {
    clearInterval(id);
  });
  intervals.clear();
});
