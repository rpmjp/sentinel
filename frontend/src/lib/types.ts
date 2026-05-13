/**
 * TypeScript types matching the FastAPI backend schemas.
 * Update these when api/schemas/ changes.
 */

export type RiskBand = "high" | "medium" | "low";
export type Decision = "confirmed_fraud" | "false_positive" | "escalated";

export interface TopFeature {
  name: string;
  value: number;
  contribution: number;
}

export interface ScoreResponse {
  transaction_id: string;
  prediction_id: string;
  score: number;
  risk_band: RiskBand;
  threshold: number;
  top_features: TopFeature[];
  latency_ms: number;
}

export interface QueueItem {
  transaction_id: string;
  prediction_id: string;
  score: number;
  risk_band: RiskBand;
  amount: number;
  type: string;
  name_orig: string;
  name_dest: string;
  scored_at: string;
  decision: Decision | null;
}

export interface QueueResponse {
  items: QueueItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface TransactionDetail {
  transaction_id: string;
  prediction_id: string;
  step: number;
  type: string;
  amount: number;
  name_orig: string;
  old_balance_org: number;
  name_dest: string;
  old_balance_dest: number;
  score: number;
  risk_band: RiskBand;
  threshold_at_scoring: number;
  latency_ms: number;
  explanation: { top_features: TopFeature[] };
  received_at: string;
  scored_at: string;
  is_fraud: boolean | null;
  decision: Decision | null;
  decision_notes: string | null;
  decided_at: string | null;
}

export interface FeedbackPayload {
  decision: Decision;
  notes?: string;
}