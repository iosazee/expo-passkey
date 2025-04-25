// Reexport the native module. On web, it will be resolved to ExpoPasskeyModule.web.ts
// and on native platforms to ExpoPasskeyModule.ts
export { default } from './ExpoPasskeyModule';
export { default as ExpoPasskeyModuleView } from './ExpoPasskeyModuleView';
export * from  './ExpoPasskeyModule.types';
