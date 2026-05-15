import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  User as UserIcon,
  Building2,
  Cpu,
  Bell,
  Shield,
  Save,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { useUpdateThreshold } from "@/lib/hooks";
import { fmtRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";

const ROLE_CAPABILITIES = [
  { label: "Review queue", analyst: true, senior_analyst: true, admin: true },
  { label: "Create cases", analyst: true, senior_analyst: true, admin: true },
  { label: "Batch upload", analyst: false, senior_analyst: true, admin: true },
  { label: "Tune threshold", analyst: false, senior_analyst: false, admin: true },
];

interface ModelRow {
  id: string;
  name: string;
  version: string;
  stage: string;
  threshold: number;
  created_at: string;
}

function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: async () => {
      const { data } = await api.get<ModelRow[]>("/models");
      return data;
    },
  });
}

export default function Settings() {
  const { user } = useAuth();
  const models = useModels();
  const updateThreshold = useUpdateThreshold();
  const prodModel = models.data?.find((m) => m.stage === "production");

  const [threshold, setThreshold] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const isAdmin = user?.role === "admin";
  const currentThreshold = threshold ?? prodModel?.threshold ?? 0.5;

  async function handleSaveThreshold() {
    if (!prodModel || threshold === null) return;
    try {
      await updateThreshold.mutateAsync({ modelId: prodModel.id, threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(`Threshold updated to ${threshold.toFixed(2)}`);
    } catch {
      toast.error("Failed to update threshold");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          <Section title="Profile" icon={UserIcon}>
            <Row label="Name"><span className="font-medium">{user?.full_name ?? "—"}</span></Row>
            <Row label="Email"><span className="font-mono text-xs">{user?.email ?? "—"}</span></Row>
            <Row label="Role"><RoleBadge role={user?.role ?? ""} /></Row>
          </Section>

          <Section title="Tenant" icon={Building2}>
            <Row label="Slug"><span className="font-mono text-xs">{user?.tenant_slug ?? "—"}</span></Row>
            <Row label="ID">
              <span className="font-mono text-xs break-all text-right" style={{ color: "var(--color-fg-faint)" }}>
                {user?.tenant_id ?? "—"}
              </span>
            </Row>
            <div className="rounded-md border p-3 text-xs" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
              <div className="font-medium mb-1">Demo tenant scope</div>
              <div style={{ color: "var(--color-fg-subtle)" }}>
                All queue, case, upload, and audit records are isolated to this tenant.
              </div>
            </div>
          </Section>
        </div>

        <Section title="Role capabilities" icon={Shield}>
          <div className="space-y-2">
            {ROLE_CAPABILITIES.map((capability) => {
              const allowed = user?.role ? capability[user.role] : false;
              return (
                <div key={capability.label} className="flex items-center justify-between gap-3 text-sm">
                  <span style={{ color: "var(--color-fg-muted)" }}>{capability.label}</span>
                  {allowed ? (
                    <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />
                  ) : (
                    <XCircle size={14} style={{ color: "var(--color-fg-faint)" }} />
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <Section title="Production model" icon={Cpu}>
        {prodModel ? (
          <>
            <Row label="Model"><span className="font-mono">{prodModel.name} v{prodModel.version}</span></Row>
            <Row label="Activated">
              <span style={{ color: "var(--color-fg-muted)" }}>{fmtRelativeTime(prodModel.created_at)}</span>
            </Row>
            <div className="flex gap-3 text-xs">
              <Link to="/models" className="inline-flex items-center gap-1" style={{ color: "var(--color-brand)" }}>
                model registry <ArrowRight size={12} />
              </Link>
              <Link to="/tuner" className="inline-flex items-center gap-1" style={{ color: "var(--color-brand)" }}>
                threshold tuner <ArrowRight size={12} />
              </Link>
            </div>
            <div className="my-3 border-t" style={{ borderColor: "var(--color-border)" }} />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-subtle)" }}>
                  Decision threshold
                </span>
                <span className="font-mono text-lg font-medium">{currentThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range" min={0.01} max={0.99} step={0.01}
                value={currentThreshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                disabled={!isAdmin}
                className="w-full accent-[var(--color-brand)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--color-fg-faint)" }}>
                  {isAdmin ? "Drag to adjust. Saves to all future scores." : "Read-only for non-admin roles."}
                </span>
                {isAdmin && threshold !== null && threshold !== prodModel.threshold && (
                  <Button variant="primary" size="sm" loading={updateThreshold.isPending} onClick={handleSaveThreshold}>
                    <Save size={12} /> save
                  </Button>
                )}
                {saved && <span style={{ color: "var(--color-success)" }} className="text-xs">✓ saved</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>No production model registered.</div>
        )}
      </Section>

      <Section title="Alert rules" icon={Bell}>
        <Toggle label="Email me on PSI drift > 0.25" enabled />
        <Toggle label="Email me on > 100 high-risk in 1h" enabled />
        <Toggle label="Email me on model latency p99 > 500ms" />
        <div className="text-[10px] mt-2 flex items-start gap-1" style={{ color: "var(--color-fg-faint)" }}>
          <AlertCircle size={10} className="mt-0.5" />
          <span>Alert delivery wiring is a Phase 4 feature.</span>
        </div>
      </Section>

      <Section title="Security" icon={Shield}>
        <Row label="Session"><span className="font-mono text-xs">JWT (24h expiry)</span></Row>
        <Row label="API access">
          <span style={{ color: "var(--color-fg-muted)" }}>Use /auth/login to obtain a bearer token</span>
        </Row>
        <Row label="Audit log">
          <Link to="/audit" className="inline-flex items-center gap-1" style={{ color: "var(--color-brand)" }}>
            review upload events <ArrowRight size={12} />
          </Link>
        </Row>
        <div className="grid md:grid-cols-3 gap-2 pt-2">
          <SecurityLimit icon={Upload} label="CSV cap" value="5 MB" />
          <SecurityLimit icon={Shield} label="Upload roles" value="senior/admin" />
          <SecurityLimit icon={AlertCircle} label="Rate limit" value="30/min" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: "var(--color-fg-subtle)" }} />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-subtle)" }}>{title}</span>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-xs" style={{ color: "var(--color-fg-faint)" }}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    admin: { bg: "var(--color-danger-soft)", fg: "var(--color-brand)" },
    senior_analyst: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
    analyst: { bg: "var(--color-surface)", fg: "var(--color-fg-muted)" },
  };
  const s = styles[role] ?? styles.analyst;
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
      style={{ background: s.bg, color: s.fg }}>
      {role || "—"}
    </span>
  );
}

function Toggle({ label, enabled }: { label: string; enabled?: boolean }) {
  const [on, setOn] = useState(!!enabled);
  return (
    <button onClick={() => setOn(!on)} className="w-full flex items-center justify-between gap-3 py-1.5 text-left">
      <span className="text-sm" style={{ color: "var(--color-fg-muted)" }}>{label}</span>
      <span className="w-8 h-4 rounded-full relative transition-colors"
        style={{ background: on ? "var(--color-brand)" : "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
          style={{ left: on ? "16px" : "2px" }} />
      </span>
    </button>
  );
}

function SecurityLimit({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border px-3 py-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--color-fg-faint)" }}>
        <Icon size={11} />
        {label}
      </div>
      <div className="font-mono text-sm mt-1">{value}</div>
    </div>
  );
}
