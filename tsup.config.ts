import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM build
  {
    entry: {
      index: 'src/index.ts',
      'client/index': 'src/client/index.ts',
      'server/index': 'src/server/index.ts',
      'types/index': 'src/types/index.ts',
    },
    format: ['esm'],
   dts: true,
    sourcemap: false,
    minify: true,
    clean: true,
    target: 'es2020',
    outDir: 'build',
    external: [
      'react-native',
      'expo-application',
      'expo-local-authentication',
      'expo-secure-store',
      'expo-crypto',
      'expo-device',
      'expo-modules-core',
      'better-auth',
      '@better-fetch/fetch',
      'zod',
      'uncrypto',
    ],
  },
  // CJS build
  {
    entry: {
      index: 'src/index.ts',
      'client/index': 'src/client/index.ts',
      'server/index': 'src/server/index.ts',
      'types/index': 'src/types/index.ts',
    },
    format: ['cjs'],
    dts: false,
    sourcemap: false,
    minify: true,
    clean: false,
    target: 'es2020',
    outDir: 'build/cjs',
    external: [
      'react-native',
      'expo-application',
      'expo-local-authentication',
      'expo-secure-store',
      'expo-crypto',
      'expo-device',
      'expo-modules-core',
      'better-auth',
      '@better-fetch/fetch',
      'zod',
      'uncrypto',
    ],
  },
]);