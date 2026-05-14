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

  const running = status.data?.running ?? false;
  const replayed = status.data?.transactions_replayed ?? 0;
  const fraud = status.data?.fraud_detected ?? 0;
  const elapsed = status.data?.elapsed_seconds ?? 0;
  const rate = status.data?.rate_per_second ?? 0;

  async function handleStart() {
    try {
      await start.mutateAsync({
        rate_per_second: 5,
        duration_seconds: 60,
        fraud_fraction: 0.15,
      });
      toast.success("Replay started: 5 txns/sec for 60 seconds");
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
            <span>{rate}/sec</span>
            <span>{elapsed.toFixed(0)}s elapsed</span>
          </div>
        </div>
      ) : (
        <div className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Start streaming synthetic transactions to see the dashboard react in
          real time.
        </div>
      )}
    </Card>
  );
}