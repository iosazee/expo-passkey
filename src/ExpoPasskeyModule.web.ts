import { registerWebModule, NativeModule } from 'expo';

import { ExpoPasskeyModuleEvents } from './ExpoPasskeyModule.types';

class ExpoPasskeyModule extends NativeModule<ExpoPasskeyModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoPasskeyModule);
