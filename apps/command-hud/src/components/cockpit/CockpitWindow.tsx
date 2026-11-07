import React, { useEffect, useRef, useState } from 'react';
import { AvionicsCockpitView } from './AvionicsCockpitView';
import { openCockpitChannel, type CockpitFeed, type CockpitMessage } from '../../cockpit/cockpitFeed';

/** The /cockpit side window: listens for the main HUD window's feed and sends commands back. */
export const CockpitWindow: React.FC = () => {
  const [feed, setFeed] = useState<CockpitFeed | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = openCockpitChannel();
    channelRef.current = channel;
    if (!channel) return undefined;
    channel.onmessage = (event: MessageEvent<CockpitMessage>) => {
      if (event.data?.kind === 'feed') setFeed(event.data.feed);
    };
    // Ask an already-open main window for its current feed, and keep asking until one answers.
    const hello = () => channel.postMessage({ kind: 'hello' } satisfies CockpitMessage);
    hello();
    const timer = window.setInterval(hello, 5000);
    document.title = 'SZS Cockpit';
    return () => { window.clearInterval(timer); channel.close(); };
  }, []);

  return (
    <div className="flex h-screen w-screen items-start justify-center overflow-hidden bg-[#020500]">
      <AvionicsCockpitView
        feed={feed}
        waiting
        onCommand={(command) => channelRef.current?.postMessage({ kind: 'command', command } satisfies CockpitMessage)}
      />
    </div>
  );
};
