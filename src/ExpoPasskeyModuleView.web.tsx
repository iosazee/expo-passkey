import * as React from 'react';

import { ExpoPasskeyModuleViewProps } from './ExpoPasskeyModule.types';

export default function ExpoPasskeyModuleView(props: ExpoPasskeyModuleViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
