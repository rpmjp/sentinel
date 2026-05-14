import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

interface ChartContainerProps {
  height: number;
  children: ReactElement;
}

export function ChartContainer({ height, children }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    function measure() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setReady(rect.width > 0 && rect.height > 0);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height, minWidth: 0 }}>
      {ready && (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
