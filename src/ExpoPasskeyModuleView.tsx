import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoPasskeyModuleViewProps } from './ExpoPasskeyModule.types';

const NativeView: React.ComponentType<ExpoPasskeyModuleViewProps> =
  requireNativeView('ExpoPasskeyModule');

export default function ExpoPasskeyModuleView(props: ExpoPasskeyModuleViewProps) {
  return <NativeView {...props} />;
}
