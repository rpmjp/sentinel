import { useState } from "react";
import { Play, Square, Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  useReplayStatus,
  useStartReplay,
  useStopReplay,
} from "@/lib/hooks";
import { fmtNumber } from "@/lib/format";
import { toast } from "@/lib/toast";

/**
 * Compact card to start/stop the streaming replay engine. Visible in the
 * dashboard sidebar. When running, displays a live counter that ticks.
 */
export function ReplayControl() {
  const status = useReplayStatus();
  const start = useStartReplay();
  const stop = useStopReplay();
  const [replayRate, setReplayRate] = useState(5);
  const [duration, setDuration] = useState(60);
  const [fraudFraction, setFraudFraction] = useState(15);

  const running = status.data?.running ?? false;
  const replayed = status.data?.transactions_replayed ?? 0;
  const fraud = status.data?.fraud_detected ?? 0;
  const elapsed = status.data?.elapsed_seconds ?? 0;
  const activeRate = status.data?.rate_per_second ?? 0;

  async function handleStart() {
    try {
      await start.mutateAsync({
        rate_per_second: replayRate,
        duration_seconds: duration,
        fraud_fraction: fraudFraction / 100,
      });
      toast.success(`Replay started: ${replayRate} txns/sec for ${duration} seconds`);
    } catch {
      toast.error("Could not start replay");
    }
  }

  async function handleStop() {
    try {
      await stop.mutateAsync();
      toast.info("Replay stopped");
    } catch {
      toast.error("Could not stop replay");
    }
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity
            size={14}
            style={{
              color: running ? "var(--color-success)" : "var(--color-fg-subtle)",
            }}
            className={running ? "animate-pulse" : ""}
          />
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Live replay
          </span>
        </div>
        {running ? (
          <Button
            variant="secondary"
            size="sm"
            loading={stop.isPending}
            onClick={handleStop}
          >
            <Square size={11} /> stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={start.isPending}
            onClick={handleStart}
          >
            <Play size={11} /> start
          </Button>
        )}
      </div>

      {running ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-fg-faint)" }}
            >
              streamed
            </span>
            <span className="font-mono text-2xl font-medium">
              {fmtNumber(replayed)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--color-fg-faint)" }}
            >
              flagged
            </span>
            <span
              className="font-mono text-base font-medium"
              style={{ color: "var(--color-brand)" }}
            >
              {fmtNumber(fraud)}
            </span>
          </div>
          <div
            className="flex items-baseline justify-between text-[10px] font-mono"
            style={{ color: "var(--color-fg-faint)" }}
          >
            <span>{activeRate}/sec</span>
            <span>{elapsed.toFixed(0)}s elapsed</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <ControlField
              label="rate"
              value={replayRate}
              min={1}
              max={25}
              step={1}
              suffix="/sec"
              onChange={setReplayRate}
            />
            <ControlField
              label="duration"
              value={duration}
              min={15}
              max={300}
              step={15}
              suffix="s"
              onChange={setDuration}
            />
            <ControlField
              label="fraud"
              value={fraudFraction}
              min={1}
              max={50}
              step={1}
              suffix="%"
              onChange={setFraudFraction}
            />
          </div>
          <div className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
            Tune the replay load and watch the dashboard react in real time.
          </div>
        </div>
      )}
    </Card>
  );
}

function ControlField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-fg-faint)" }}
      >
        {label}
      </span>
      <div
        className="flex items-center rounded-md border px-2 py-1"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : min);
          }}
          className="min-w-0 w-full bg-transparent outline-none text-xs font-mono"
          style={{ color: "var(--color-fg)" }}
        />
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--color-fg-faint)" }}
        >
          {suffix}
        </span>
      </div>
    </label>
  );
}
