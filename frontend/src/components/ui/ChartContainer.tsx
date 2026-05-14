import { cloneElement, useLayoutEffect, useRef, useState, type ReactElement } from "react";

interface ChartContainerProps {
  height: number;
  children: ReactElement<Record<string, unknown>>;
}

export function ChartContainer({ height, children }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    function measure() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setWidth(Math.floor(rect.width));
    }

    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height, minWidth: 0 }}>
      {width > 1 && cloneElement(children, { width, height })}
    </div>
  );
}
