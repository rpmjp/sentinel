import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  Decision,
  FeedbackPayload,
  QueueResponse,
  RiskBand,
  TransactionDetail,
} from "./types";

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

export function useSimilarTransactions(transactionId: string | undefined) {
  return useQuery({
    queryKey: ["similar-transactions", transactionId],
    queryFn: async () => {
      const { data } = await api.get<InvestigateItem[]>(
        `/investigate/similar/${transactionId}`,
      );
      return data;
    },
    enabled: !!transactionId,
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
