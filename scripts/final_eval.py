"""Final test-set evaluation for the chosen champion model.

Test set is touched exactly once at the end of Phase 1. Per the model card,
val metrics drove model selection; this script reports the held-out number.

Usage:
    uv run python scripts/final_eval.py
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ml.features.pipeline import prepare
from ml.training.metrics import evaluate

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

CHAMPION = "lightgbm"
MODEL_PATH = Path(f"models/{CHAMPION}.joblib")
DATA_PATH = Path("data/raw/paysim.csv")
REPORT_PATH = Path(f"models/{CHAMPION}_final_test_report.json")


def main() -> None:
    log.info("Loading champion model: %s", MODEL_PATH)
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]

    log.info("Loading data")
    raw = pd.read_csv(DATA_PATH)
    data = prepare(raw)

    log.info("Scoring test set (%d rows, %d fraud)", len(data.X_test), data.y_test.sum())
    test_score = model.predict_proba(data.X_test)[:, 1]
    report = evaluate(np.asarray(data.y_test), test_score)

    log.info("=" * 60)
    log.info("FINAL TEST REPORT — %s", CHAMPION)
    log.info("=" * 60)
    for k, v in report.to_dict().items():
        if isinstance(v, float):
            log.info("  %-30s %.6f", k, v)
        else:
            log.info("  %-30s %d", k, v)

    REPORT_PATH.write_text(json.dumps(report.to_dict(), indent=2))
    log.info("Saved %s", REPORT_PATH)


if __name__ == "__main__":
    main()