"""Training entrypoint with early stopping, per-iteration logging, and proper diagnostics.

Usage:
    uv run python -m ml.training.train --model lightgbm
    uv run python -m ml.training.train --model xgboost
    uv run python -m ml.training.train --model logreg
    uv run python -m ml.training.train --model lightgbm --sample-frac 0.1
"""

from __future__ import annotations

import argparse
import logging
import subprocess
from pathlib import Path
from typing import Any

import joblib
import mlflow
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, early_stopping, log_evaluation
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from ml.features.pipeline import prepare
from ml.training.metrics import evaluate

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DATA_PATH = Path("data/raw/paysim.csv")
MODELS_DIR = Path("models")
EXPERIMENT_NAME = "sentinel-fraud-detection"
TRACKING_URI = "file:./mlruns"


def _git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def _fit_lightgbm(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    scale_pos_weight: float,
) -> LGBMClassifier:
    """Fit LightGBM with early stopping on val PR-AUC."""
    model = LGBMClassifier(
        n_estimators=500,
        learning_rate=0.1,
        max_depth=6,
        num_leaves=31,
        min_child_samples=50,
        reg_lambda=1.0,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        verbose=-1,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        eval_names=["train", "val"],
        eval_metric="average_precision",
        callbacks=[
            early_stopping(stopping_rounds=50, verbose=True),
            log_evaluation(period=25),
        ],
    )
    return model


def _fit_xgboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    scale_pos_weight: float,
) -> XGBClassifier:
    """Fit XGBoost with early stopping on val aucpr."""
    model = XGBClassifier(
        n_estimators=2000,
        learning_rate=0.05,
        max_depth=8,
        scale_pos_weight=scale_pos_weight,
        tree_method="hist",
        random_state=42,
        n_jobs=-1,
        eval_metric="aucpr",
        early_stopping_rounds=50,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        verbose=25,
    )
    return model


def _fit_logreg(X_train: pd.DataFrame, y_train: pd.Series) -> Pipeline:
    """Logistic regression baseline. No early stopping needed."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
            n_jobs=-1,
        )),
    ]).fit(X_train, y_train)


def _log_per_iteration_curves(model: Any, model_name: str) -> None:
    """Log per-iteration train/val curves to MLflow as step-indexed metrics."""
    if model_name == "lightgbm":
        results = model.evals_result_
        for split_name, metrics in results.items():
            for metric_name, values in metrics.items():
                for step, val in enumerate(values):
                    mlflow.log_metric(f"{split_name}_{metric_name}", val, step=step)
    elif model_name == "xgboost":
        results = model.evals_result_
        # XGB names splits validation_0, validation_1 (train, val by order)
        split_aliases = {"validation_0": "train", "validation_1": "val"}
        for raw_name, metrics in results.items():
            split_name = split_aliases.get(raw_name, raw_name)
            for metric_name, values in metrics.items():
                for step, val in enumerate(values):
                    mlflow.log_metric(f"{split_name}_{metric_name}", val, step=step)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["lightgbm", "xgboost", "logreg"], default="lightgbm")
    parser.add_argument("--sample-frac", type=float, default=1.0)
    parser.add_argument("--data-path", type=Path, default=DATA_PATH)
    args = parser.parse_args()

    log.info("Loading %s", args.data_path)
    raw = pd.read_csv(args.data_path)

    if args.sample_frac < 1.0:
        fraud = raw[raw["isFraud"] == 1].sample(frac=args.sample_frac, random_state=42)
        non_fraud = raw[raw["isFraud"] == 0].sample(frac=args.sample_frac, random_state=42)
        raw = pd.concat([fraud, non_fraud]).sort_values("step").reset_index(drop=True)
        log.info("Sampled to %d rows (%d fraud)", len(raw), int(raw["isFraud"].sum()))

    log.info("Preparing data")
    data = prepare(raw)
    log.info(
        "Splits: train=%d (%d fraud, %.4f%%) val=%d (%d fraud, %.4f%%) test=%d (%d fraud, %.4f%%)",
        len(data.X_train), data.y_train.sum(), 100 * data.y_train.mean(),
        len(data.X_val), data.y_val.sum(), 100 * data.y_val.mean(),
        len(data.X_test), data.y_test.sum(), 100 * data.y_test.mean(),
    )
    log.info("Features (%d): %s", len(data.feature_names), data.feature_names)

    scale_pos_weight = float((data.y_train == 0).sum() / max((data.y_train == 1).sum(), 1))
    log.info("scale_pos_weight = %.2f", scale_pos_weight)

    mlflow.set_tracking_uri(TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)

    with mlflow.start_run(run_name=f"{args.model}_frac{args.sample_frac}"):
        mlflow.set_tag("git_sha", _git_sha())
        mlflow.set_tag("model", args.model)
        mlflow.log_param("sample_frac", args.sample_frac)
        mlflow.log_param("scale_pos_weight", scale_pos_weight)
        mlflow.log_param("n_features", len(data.feature_names))
        mlflow.log_param("n_train", len(data.X_train))
        mlflow.log_param("n_val", len(data.X_val))
        mlflow.log_param("n_test", len(data.X_test))

        log.info("Fitting %s", args.model)
        if args.model == "lightgbm":
            model = _fit_lightgbm(data.X_train, data.y_train, data.X_val, data.y_val, scale_pos_weight)
        elif args.model == "xgboost":
            model = _fit_xgboost(data.X_train, data.y_train, data.X_val, data.y_val, scale_pos_weight)
        else:
            model = _fit_logreg(data.X_train, data.y_train)

        # Log per-iteration curves (boosting models only)
        if args.model in {"lightgbm", "xgboost"}:
            _log_per_iteration_curves(model, args.model)

        for p, v in (model.get_params(deep=False) if args.model != "logreg" else {}).items():
            mlflow.log_param(f"model__{p}", v)

        log.info("Evaluating on validation set")
        val_score = model.predict_proba(data.X_val)[:, 1]
        val_report = evaluate(np.asarray(data.y_val), val_score)
        for k, v in val_report.to_dict().items():
            mlflow.log_metric(f"val_{k}", v)

        # Test set is logged to MLflow but NOT printed — peeking at test
        # during model selection is leakage. We look at test only once,
        # at the end of Phase 1, after the final model is chosen.
        test_score = model.predict_proba(data.X_test)[:, 1]
        test_report = evaluate(np.asarray(data.y_test), test_score)
        for k, v in test_report.to_dict().items():
            mlflow.log_metric(f"test_{k}", v)

        log.info(
            "Val: ROC-AUC=%.4f PR-AUC=%.4f best_savings=$%.0f @ t=%.2f",
            val_report.roc_auc, val_report.pr_auc,
            val_report.best_net_savings, val_report.best_threshold,
        )

        # Feature importance (boosting models)
        if hasattr(model, "feature_importances_"):
            importances = pd.Series(model.feature_importances_, index=data.feature_names)
            top = importances.sort_values(ascending=False).head(15)
            log.info("Top 15 features by importance:\n%s", top.to_string())

        MODELS_DIR.mkdir(exist_ok=True)
        artifact_path = MODELS_DIR / f"{args.model}.joblib"
        joblib.dump(
            {"model": model, "feature_names": data.feature_names,
             "best_threshold": val_report.best_threshold},
            artifact_path,
        )
        mlflow.log_artifact(str(artifact_path), artifact_path="model")
        log.info("Saved %s", artifact_path)


if __name__ == "__main__":
    main()