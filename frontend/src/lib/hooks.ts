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