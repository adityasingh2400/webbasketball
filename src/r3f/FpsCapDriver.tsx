import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect } from 'react';

/** Max R3F `advance` calls per second (sim + render). Use on high-refresh displays to limit CPU/GPU churn. */
export const R3F_MAX_FPS = 120;

/**
 * Drive the loop when `Canvas` uses `frameloop="never"`, at most `R3F_MAX_FPS` ticks/sec.
 * Vsync still applies to the final swap; this mainly caps simulation + scene work on 144/240 Hz monitors.
 */
export function FpsCapDriver() {
  const advance = useThree((s) => s.advance);

  useLayoutEffect(() => {
    advance(performance.now(), true);
  }, [advance]);

  useEffect(() => {
    const minMs = 1000 / R3F_MAX_FPS;
    let raf = 0;
    let then = performance.now() - minMs;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - then < minMs) return;
      const elapsed = now - then;
      then = now - (elapsed % minMs);
      advance(now, true);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [advance]);

  return null;
}
