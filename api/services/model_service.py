"""Model service — loads the joblib artifact and serves scores + explanations.

CRITICAL: imports ml.features.transforms — the SAME module used at training
time. This eliminates training-serving skew, the #1 source of production
ML bugs.

The artifact contains:
    - model: CalibratedClassifierCV wrapping the trained LightGBM
    - feature_names: ordered list of expected columns
    - best_threshold: the val-tuned decision threshold

Inputs are a list of raw transactions (PaySim schema). The service:
    1. Runs the same per-row transforms as training
    2. One-hot encodes 'type' to match training columns
    3. Reindexes to the exact feature order the model expects
    4. Calls predict_proba on the calibrator
    5. Computes SHAP top contributors per row (via the wrapped base model)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap

from api.config import get_settings
from ml.features.transforms import add_row_features, drop_leakage

log = logging.getLogger("sentinel.model")

# Risk band thresholds (calibrated probability)
HIGH_THRESHOLD = 0.50
MEDIUM_THRESHOLD = 0.15

# Columns one-hot encoded at training time
CATEGORICAL = ["type"]

# Columns dropped before training (must match ml/features/pipeline.py)
DROP_BEFORE_PREDICT = ["nameOrig", "nameDest", "step", "isFraud"]


@dataclass(frozen=True)
class TopFeature:
    name: str
    value: float
    contribution: float  # signed SHAP value


@dataclass(frozen=True)
class ScoredTransaction:
    score: float
    risk_band: str  # high|medium|low
    threshold: float
    top_features: list[TopFeature]
    latency_ms: float


def _risk_band(score: float) -> str:
    if score >= HIGH_THRESHOLD:
        return "high"
    if score >= MEDIUM_THRESHOLD:
        return "medium"
    return "low"


class ModelService:
    """Thread-safe model holder with hot-reload capability."""

    def __init__(self, model_path: str | None = None) -> None:
        self._lock = Lock()
        self._path = Path(model_path or get_settings().model_path)
        self._model: Any = None
        self._feature_names: list[str] = []
        self._threshold: float = 0.5
        self._explainer: shap.TreeExplainer | None = None
        self._loaded = False

    def load(self) -> None:
        """Load (or reload) the model artifact."""
        with self._lock:
            log.info("Loading model from %s", self._path)
            if not self._path.exists():
                raise FileNotFoundError(f"Model artifact not found: {self._path}")

            bundle = joblib.load(self._path)
            self._model = bundle["model"]
            self._feature_names = list(bundle["feature_names"])
            self._threshold = float(bundle.get("best_threshold", 0.5))

            # Build SHAP explainer from the underlying LightGBM
            # (CalibratedClassifierCV wraps a FrozenEstimator wrapping the booster)
            base = self._unwrap_base()
            try:
                self._explainer = shap.TreeExplainer(base)
                log.info("SHAP TreeExplainer ready")
            except Exception as e:  # noqa: BLE001
                log.warning("Could not build SHAP explainer: %s", e)
                self._explainer = None

            self._loaded = True
            log.info(
                "Model loaded: %d features, threshold=%.3f",
                len(self._feature_names),
                self._threshold,
            )

    def _unwrap_base(self) -> Any:
        """Pull the underlying tree booster out of CalibratedClassifierCV."""
        # CalibratedClassifierCV in sklearn 1.8 stores fitted calibrators
        # in .calibrated_classifiers_[0].estimator (post-FrozenEstimator unwrap)
        cc = self._model.calibrated_classifiers_[0]
        est = cc.estimator
        # FrozenEstimator stores wrapped model on .estimator
        return est.estimator if hasattr(est, "estimator") else est

    @property
    def threshold(self) -> float:
        return self._threshold

    @property
    def feature_names(self) -> list[str]:
        return list(self._feature_names)

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _prepare(self, rows: list[dict[str, Any]]) -> pd.DataFrame:
        """Apply the same transforms used at training time."""
        df = pd.DataFrame(rows)
        df = add_row_features(df)
        df = drop_leakage(df)
        df = pd.get_dummies(df, columns=CATEGORICAL, dtype=float)

        # Drop non-feature cols if present
        df = df.drop(
            columns=[c for c in DROP_BEFORE_PREDICT if c in df.columns],
            errors="ignore",
        )

        # Reindex to the exact training order, filling missing one-hot cols with 0
        return df.reindex(columns=self._feature_names, fill_value=0.0)

    def score(
        self,
        rows: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[ScoredTransaction]:
        """Score a batch of transactions. Returns one ScoredTransaction per input row."""
        if not self._loaded:
            raise RuntimeError("Model not loaded. Call load() first.")
        if not rows:
            return []

        t0 = time.perf_counter()
        X = self._prepare(rows)
        scores = self._model.predict_proba(X)[:, 1]
        prep_score_ms = (time.perf_counter() - t0) * 1000

        # SHAP — best-effort, per row
        shap_rows: list[np.ndarray] | None = None
        if self._explainer is not None:
            try:
                sv = self._explainer.shap_values(X)
                # LightGBM binary may return a single array or a list of two
                if isinstance(sv, list):
                    sv = sv[1]
                shap_rows = [sv[i] for i in range(len(X))]
            except Exception as e:  # noqa: BLE001
                log.warning("SHAP failed: %s", e)

        results: list[ScoredTransaction] = []
        latency_per_row = prep_score_ms / max(len(rows), 1)

        for i, score in enumerate(scores):
            top: list[TopFeature] = []
            if shap_rows is not None:
                contribs = shap_rows[i]
                abs_sorted = np.argsort(-np.abs(contribs))[:top_k]
                for j in abs_sorted:
                    top.append(
                        TopFeature(
                            name=self._feature_names[j],
                            value=float(X.iloc[i, j]),
                            contribution=float(contribs[j]),
                        )
                    )

            results.append(
                ScoredTransaction(
                    score=float(score),
                    risk_band=_risk_band(float(score)),
                    threshold=self._threshold,
                    top_features=top,
                    latency_ms=latency_per_row,
                )
            )

        return results


# Module-level singleton, initialized at API startup
_service: ModelService | None = None


def get_model_service() -> ModelService:
    """FastAPI dependency."""
    if _service is None or not _service.is_loaded:
        raise RuntimeError("ModelService not initialized; check lifespan startup")
    return _service


def init_model_service(model_path: str | None = None) -> ModelService:
    """Called once at API startup from lifespan."""
    global _service
    _service = ModelService(model_path=model_path)
    _service.load()
    return _service