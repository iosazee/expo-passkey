import { NativeModule, requireNativeModule } from 'expo';

import { ExpoPasskeyModuleEvents } from './ExpoPasskeyModule.types';

declare class ExpoPasskeyModule extends NativeModule<ExpoPasskeyModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoPasskeyModule>('ExpoPasskeyModule');
