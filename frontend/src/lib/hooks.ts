import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Decision, FeedbackPayload, QueueResponse, RiskBand, TransactionDetail } from "./types";

export interface DashboardKpis {
  open_cases: number;
  blocked_amount_24h: number;
  txn_count_24h: number;
  avg_score_24h: number;
  high_risk_24h: number;
  medium_risk_24h: number;
  low_risk_24h: number;
}

export function useKpis(hours = 24) {
  return useQuery({
    queryKey: ["kpis", hours],
    queryFn: async () => {
      const { data } = await api.get<DashboardKpis>("/dashboard/kpis", {
        params: { hours },
      });
      return data;
    },
    refetchInterval: 10_000,
  });
}

export function useSparkline(hours = 24) {
  return useQuery({
    queryKey: ["sparkline", hours],
    queryFn: async () => {
      const { data } = await api.get<number[]>("/dashboard/sparkline", {
        params: { hours },
      });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useQueue(params: { risk?: string; page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: ["queue", params],
    queryFn: async () => {
      const { data } = await api.get<QueueResponse>("/queue", { params });
      return data;
    },
    refetchInterval: 5_000,
  });
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const { data } = await api.get<TransactionDetail>(`/transactions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useSubmitFeedback(transactionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: FeedbackPayload) => {
      const { data } = await api.post(
        `/transactions/${transactionId}/feedback`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transaction", transactionId] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

export interface InvestigateParams {
  q?: string;
  txn_type?: string;
  risk?: string;
  decision?: string;
  min_amount?: number;
  max_amount?: number;
  min_score?: number;
  max_score?: number;
  page?: number;
  page_size?: number;
}

export interface InvestigateItem {
  transaction_id: string;
  score: number;
  risk_band: RiskBand;
  amount: number;
  type: string;
  name_orig: string;
  name_dest: string;
  scored_at: string;
  decision: Decision | null;
}

export interface InvestigateStats {
  total: number;
  total_amount: number;
  confirmed_fraud: number;
  false_positives: number;
  pending: number;
  avg_score: number;
}

export interface InvestigateResponse {
  items: InvestigateItem[];
  total: number;
  page: number;
  page_size: number;
  stats: InvestigateStats;
}

export function useInvestigate(params: InvestigateParams) {
  return useQuery({
    queryKey: ["investigate", params],
    queryFn: async () => {
      const { data } = await api.get<InvestigateResponse>("/investigate", { params });
      return data;
    },
  });
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      transaction_ids: string[];
      decision: Decision;
      notes?: string;
    }) => {
      const { data } = await api.post<{ updated: number }>(
        "/investigate/bulk",
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investigate"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

export interface EntitySummary {
  account_id: string;
  total_transactions: number;
  sent_count: number;
  received_count: number;
  total_amount: number;
  high_risk_count: number;
  confirmed_fraud_count: number;
  avg_score: number;
  first_seen: string | null;
  last_seen: string | null;
  watchlist: "blocked" | "trusted" | null;
}

export interface EntityTransaction {
  transaction_id: string;
  direction: "sent" | "received";
  counterparty: string;
  type: string;
  amount: number;
  score: number;
  risk_band: RiskBand;
  scored_at: string;
  decision: Decision | null;
}

export interface EntityTrendPoint {
  bucket: string;
  txn_count: number;
  high_risk_count: number;
  avg_score: number;
}

export interface EntityGraphNode {
  id: string;
  label: string;
  role: "entity" | "counterparty";
  risk_score: number;
  amount: number;
}

export interface EntityGraphEdge {
  source: string;
  target: string;
  count: number;
  amount: number;
}

export interface EntityProfile {
  summary: EntitySummary;
  transactions: EntityTransaction[];
  trend: EntityTrendPoint[];
  graph: {
    nodes: EntityGraphNode[];
    edges: EntityGraphEdge[];
  };
}

export function useEntityProfile(accountId: string | undefined) {
  return useQuery({
    queryKey: ["entity-profile", accountId],
    queryFn: async () => {
      const { data } = await api.get<EntityProfile>(
        `/entities/${encodeURIComponent(accountId ?? "")}`,
      );
      return data;
    },
    enabled: !!accountId,
  });
}

export interface WatchlistItem {
  id: string;
  account_id: string;
  list_type: "blocked" | "trusted";
  reason: string | null;
  created_at: string;
}

export function useWatchlists() {
  return useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const { data } = await api.get<{ items: WatchlistItem[] }>("/watchlists");
      return data;
    },
  });
}

export function useAddWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      account_id: string;
      list_type: "blocked" | "trusted";
      reason?: string;
    }) => {
      const { data } = await api.post<WatchlistItem>("/watchlists", payload);
      return data;
    },
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      qc.invalidateQueries({ queryKey: ["entity-profile", payload.account_id] });
    },
  });
}

export function useDeleteWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      await api.delete(`/watchlists/${entryId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      qc.invalidateQueries({ queryKey: ["entity-profile"] });
    },
  });
}

export function useRemoveWatchlistAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      account_id: string;
      list_type: "blocked" | "trusted";
    }) => {
      await api.delete(
        `/watchlists/account/${encodeURIComponent(payload.account_id)}/${payload.list_type}`,
      );
    },
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      qc.invalidateQueries({ queryKey: ["entity-profile", payload.account_id] });
    },
  });
}

export function useSimilarTransactions(transactionId: string | undefined) {
  return useQuery({
    queryKey: ["similar", transactionId],
    queryFn: async () => {
      const { data } = await api.get<InvestigateItem[]>(
        `/investigate/similar/${transactionId}`,
      );
      return data;
    },
    enabled: !!transactionId,
  });
}

export function useUpdateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      modelId,
      threshold,
    }: {
      modelId: string;
      threshold: number;
    }) => {
      const { data } = await api.patch(`/models/${modelId}/threshold`, {
        threshold,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["models"] });
      qc.invalidateQueries({ queryKey: ["tuner"] });
    },
  });
}

export interface TimeseriesPoint {
  timestamp: string;
  txn_count: number;
  fraud_count: number;
  blocked_amount: number;
  avg_score: number;
}

export function useTimeseries(hours = 24) {
  return useQuery({
    queryKey: ["timeseries", hours],
    queryFn: async () => {
      const { data } = await api.get<TimeseriesPoint[]>("/dashboard/timeseries", {
        params: { hours },
      });
      return data;
    },
    refetchInterval: 10_000,
  });
}

export interface HeatmapCell {
  day: number;
  hour: number;
  count: number;
  fraud_rate: number;
}

export function useHeatmap() {
  return useQuery({
    queryKey: ["heatmap"],
    queryFn: async () => {
      const { data } = await api.get<HeatmapCell[]>("/dashboard/heatmap");
      return data;
    },
    refetchInterval: 60_000,
  });
}

export interface TypeBreakdown {
  type: string;
  high: number;
  medium: number;
  low: number;
}

export function useTypeBreakdown() {
  return useQuery({
    queryKey: ["type-breakdown"],
    queryFn: async () => {
      const { data } = await api.get<TypeBreakdown[]>("/dashboard/type-breakdown");
      return data;
    },
    refetchInterval: 30_000,
  });
}

export interface ReplayStatus {
  running: boolean;
  transactions_replayed: number;
  fraud_detected: number;
  started_at: string | null;
  rate_per_second: number | null;
  elapsed_seconds: number | null;
}

export function useReplayStatus() {
  return useQuery({
    queryKey: ["replay-status"],
    queryFn: async () => {
      const { data } = await api.get<ReplayStatus>("/replay/status");
      return data;
    },
    refetchInterval: 1_000,
  });
}

export function useStartReplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      rate_per_second: number;
      duration_seconds: number;
      fraud_fraction: number;
    }) => {
      const { data } = await api.post<ReplayStatus>("/replay/start", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replay-status"] });
    },
  });
}

export function useStopReplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ReplayStatus>("/replay/stop");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["replay-status"] });
    },
  });
}

export interface UploadTransactionsResult {
  uploaded: number;
  scored: number;
  high: number;
  medium: number;
  low: number;
  rejected: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  total_latency_ms: number;
}

export function useUploadTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post<UploadTransactionsResult>(
        "/upload/transactions",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] });
      qc.invalidateQueries({ queryKey: ["investigate"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["timeseries"] });
      qc.invalidateQueries({ queryKey: ["type-breakdown"] });
      qc.invalidateQueries({ queryKey: ["heatmap"] });
    },
  });
}

export interface GeoBucket {
  code: string;
  name: string;
  count: number;
  fraud_count: number;
  total_amount: number;
  fraud_rate: number;
}

export function useGeoWorld() {
  return useQuery({
    queryKey: ["geo-world"],
    queryFn: async () => {
      const { data } = await api.get<GeoBucket[]>("/dashboard/geo/world");
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useGeoUs() {
  return useQuery({
    queryKey: ["geo-us"],
    queryFn: async () => {
      const { data } = await api.get<GeoBucket[]>("/dashboard/geo/us");
      return data;
    },
    refetchInterval: 60_000,
  });
}

export type CaseStatus = "open" | "investigating" | "waiting" | "escalated" | "closed";
export type CasePriority = "low" | "medium" | "high" | "critical";

export interface CaseStats {
  open: number;
  overdue: number;
  critical: number;
  unassigned: number;
}

export interface CaseSummary {
  id: string;
  title: string;
  description: string | null;
  status: CaseStatus;
  priority: CasePriority;
  assigned_to: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  outcome: string | null;
  transaction_count: number;
  entity_count: number;
  note_count: number;
}

export interface CaseEntity {
  account_id: string;
  role: string;
  added_at: string;
}

export interface CaseNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface CaseDetail extends CaseSummary {
  transactions: InvestigateItem[];
  entities: CaseEntity[];
  notes: CaseNote[];
}

export interface CreateCasePayload {
  title: string;
  description?: string;
  priority: CasePriority;
  status?: CaseStatus;
  assigned_to?: string | null;
  sla_due_at?: string | null;
  transaction_ids?: string[];
  entity_ids?: string[];
}

export interface UpdateCasePayload {
  title?: string;
  description?: string | null;
  status?: CaseStatus;
  priority?: CasePriority;
  assigned_to?: string | null;
  sla_due_at?: string | null;
  outcome?: string | null;
}

export function useCases(params: {
  status?: string;
  priority?: string;
  assigned_to?: string;
  overdue?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["cases", params],
    queryFn: async () => {
      const { data } = await api.get<{ items: CaseSummary[]; stats: CaseStats }>(
        "/cases",
        { params },
      );
      return data;
    },
  });
}

export function useCase(caseId: string | undefined) {
  return useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data } = await api.get<CaseDetail>(`/cases/${caseId}`);
      return data;
    },
    enabled: !!caseId,
  });
}

export function useCreateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCasePayload) => {
      const { data } = await api.post<CaseDetail>("/cases", payload);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", data.id] });
    },
  });
}

export function useUpdateCase(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateCasePayload) => {
      const { data } = await api.patch<CaseDetail>(`/cases/${caseId}`, payload);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", data.id] });
    },
  });
}

export function useAddCaseNote(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post(`/cases/${caseId}/notes`, { content });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

export function useLinkCaseTransactions(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const { data } = await api.post<CaseDetail>(`/cases/${caseId}/transactions`, {
        transaction_ids: transactionIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

export function useUnlinkCaseTransaction(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      await api.delete(`/cases/${caseId}/transactions/${transactionId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

export function useLinkCaseEntities(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entityIds: string[]) => {
      const { data } = await api.post<CaseDetail>(`/cases/${caseId}/entities`, {
        entity_ids: entityIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

export function useUnlinkCaseEntity(caseId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await api.delete(`/cases/${caseId}/entities/${encodeURIComponent(accountId)}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}
