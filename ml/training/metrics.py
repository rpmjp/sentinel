"""Evaluation metrics for fraud detection.

ROC-AUC is reported but PR-AUC is the headline — it's the right metric for
heavy class imbalance. Cost-weighted net savings is the metric a business
actually cares about.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)

# Default costs for net-savings calculation. Plausible numbers, not real.
# Tunable per-deployment via the threshold tuner page in Phase 3.
COST_PER_MISSED_FRAUD = 1000.0   # avg loss if fraud goes through
COST_PER_FALSE_POSITIVE = 5.0    # avg analyst investigation cost


@dataclass
class EvalReport:
    roc_auc: float
    pr_auc: float
    precision_at_default: float
    recall_at_default: float
    best_threshold: float
    best_net_savings: float
    n_positive: int
    n_total: int

    def to_dict(self) -> dict[str, float | int]:
        return asdict(self)


def net_savings(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    cost_missed: float = COST_PER_MISSED_FRAUD,
    cost_fp: float = COST_PER_FALSE_POSITIVE,
) -> float:
    """Net $ savings vs. doing nothing.

    Missed fraud = false negative = cost_missed loss (relative to perfect detection).
    False positive = cost_fp loss (wasted analyst time).
    Caught fraud = cost_missed avoided.
    """
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    return tp * cost_missed - fp * cost_fp


def find_best_threshold(
    y_true: np.ndarray,
    y_score: np.ndarray,
    cost_missed: float = COST_PER_MISSED_FRAUD,
    cost_fp: float = COST_PER_FALSE_POSITIVE,
) -> tuple[float, float]:
    """Find the threshold maximizing net savings.

    Returns (best_threshold, best_net_savings).
    """
    thresholds = np.linspace(0.01, 0.99, 99)
    best_t, best_s = 0.5, -np.inf
    for t in thresholds:
        y_pred = (y_score >= t).astype(int)
        s = net_savings(y_true, y_pred, cost_missed, cost_fp)
        if s > best_s:
            best_t, best_s = float(t), float(s)
    return best_t, best_s


def evaluate(
    y_true: np.ndarray,
    y_score: np.ndarray,
    default_threshold: float = 0.5,
) -> EvalReport:
    """Compute the full evaluation report."""
    y_pred_default = (y_score >= default_threshold).astype(int)
    best_t, best_s = find_best_threshold(y_true, y_score)

    return EvalReport(
        roc_auc=float(roc_auc_score(y_true, y_score)),
        pr_auc=float(average_precision_score(y_true, y_score)),
        precision_at_default=float(precision_score(y_true, y_pred_default, zero_division=0)),
        recall_at_default=float(recall_score(y_true, y_pred_default, zero_division=0)),
        best_threshold=best_t,
        best_net_savings=best_s,
        n_positive=int(y_true.sum()),
        n_total=int(len(y_true)),
    )