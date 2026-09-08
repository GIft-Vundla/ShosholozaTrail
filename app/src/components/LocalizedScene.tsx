import { useEffect, useRef } from 'react';

type SceneController = { destroy(): void };

export function LocalizedScene({ hubId }: { hubId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let controller: SceneController | undefined;
    let cancelled = false;
    const moduleUrl = '/animations/localized-scenes.js';
    void import(/* @vite-ignore */ moduleUrl).then((module) => {
      if (cancelled || !hostRef.current) return;
      controller = module.mountLocalizedAnimation(hostRef.current, hubId, {
        controls: true,
        durationSeconds: 10,
      });
    });
    return () => {
      cancelled = true;
      controller?.destroy();
    };
  }, [hubId]);

  return <div ref={hostRef} className="react-localized-scene" data-scene-host={hubId} />;
}
