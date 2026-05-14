/**
 * Animated counters. useCountUp smoothly transitions between numbers,
 * which gives the dashboard that "live ops" feel without being gaudy.
 */

import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
}

export function useCountUp(
  target: number,
  { duration = 800, decimals = 0 }: UseCountUpOptions = {},
): number {
  const [value, setValue] = useState(target);
  const prevTarget = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === prevTarget.current) return;

    const start = value;
    const end = target;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * eased;
      setValue(parseFloat(current.toFixed(decimals)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = end;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals]);

  return value;
}