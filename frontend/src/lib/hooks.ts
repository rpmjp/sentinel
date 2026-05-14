import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { FeedbackPayload, QueueResponse, TransactionDetail } from "./types";

export interface DashboardKpis {
  open_cases: number;
  blocked_amount_24h: number;
  txn_count_24h: number;
  avg_score_24h: number;
  high_risk_24h: number;
  medium_risk_24h: number;
  low_risk_24h: number;
}

export function useKpis() {
  return useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data } = await api.get<DashboardKpis>("/dashboard/kpis");
      return data;
    },
    refetchInterval: 10_000,
  });
}

export function useSparkline() {
  return useQuery({
    queryKey: ["sparkline"],
    queryFn: async () => {
      const { data } = await api.get<number[]>("/dashboard/sparkline");
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
  risk_band: "high" | "medium" | "low";
  amount: number;
  type: string;
  name_orig: string;
  name_dest: string;
  scored_at: string;
  decision: string | null;
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
      decision: string;
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