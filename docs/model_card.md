# Model Card — Sentinel Fraud Detector v0.1

Following [Google's Model Card framework](https://modelcards.withgoogle.com/about).

## Model details

- **Model type:** Calibrated gradient-boosted decision trees
- **Base model:** LightGBM (`LGBMClassifier`, 500 estimators, depth 6)
- **Calibration:** Isotonic regression on validation set (`CalibratedClassifierCV` + `FrozenEstimator`)
- **Version:** 0.1
- **Date:** May 2026
- **Author:** Robert Jean Pierre
- **License:** MIT (code) / CC-BY-SA-4.0 (training data)

## Intended use

- **Primary use:** Score consumer financial transactions for fraud risk in a research/portfolio context
- **Primary users:** Demonstration audience — recruiters, fraud-ops practitioners evaluating the platform design
- **Out-of-scope:** Real production deployment. Trained on a single synthetic dataset (PaySim); does not generalize to real-world payment networks without retraining on production data

## Training data

- **Source:** [PaySim synthetic dataset (Kaggle)](https://www.kaggle.com/datasets/ealaxi/paysim1), CC-BY-SA-4.0
- **Size:** 6.36M transactions, 8,213 fraud (~0.13% positive rate)
- **Schema:** see [`docs/data.md`](data.md)
- **Splits:** 70/15/15 stratified random (rationale below)

### Why stratified random and not temporal

Initial design used a stratified-temporal split, the standard practice for fraud detection in real-world settings. Diagnostic analysis revealed PaySim's `step` variable is non-uniform simulator output — row volume varies 20x across step deciles, and fraud rate jumps 10x in the final 40% of the timeline. Temporal splits caused severe distributional mismatch between train and val (val logloss ~22, val PR-AUC <0.01).

**Conclusion:** PaySim's `step` is sample-index, not real time. Stratified random gives realistic train/val/test distributions. Temporal validation discipline is preserved at the platform level via Phase 4 production drift monitoring and scheduled retraining, where it actually matters.

## Features (16)

Per-row only — no identity-based aggregates.

| Feature | Type | Description |
|---|---|---|
| `amount` | float | Transaction amount |
| `oldbalanceOrg` | float | Sender balance before |
| `oldbalanceDest` | float | Receiver balance before |
| `hour` | int | step % 24 |
| `day` | int | step // 24 |
| `is_weekend` | bool | day % 7 in [5, 6] |
| `amount_log` | float | log1p(amount) |
| `balance_drained` | bool | newbalanceOrig < 0.01 |
| `drains_full_balance` | bool | amount ≈ oldbalanceOrg |
| `receiver_was_empty` | bool | oldbalanceDest < 0.01 |
| `amount_to_balance_ratio` | float | amount / (oldbalanceOrg + 1) |
| `type_*` (5 cols) | one-hot | Transaction type indicators |

### Dropped to prevent target leakage

- `newbalanceOrig`, `newbalanceDest` — post-transaction state, mechanically derived from the label
- `isFlaggedFraud` — system rule that already encodes fraud
- `nameOrig`, `nameDest`, `step` — identifiers, not predictive features

### Ablation: identity-based aggregates

Sender and receiver historical aggregates (computed via `shift(1).expanding()` to use only strictly past rows) were tested and removed. Ablation result:

| Configuration | Val PR-AUC |
|---|---|
| With sender + receiver aggregates | 0.971 |
| Per-row features only (chosen) | **0.993** |

The model performs marginally *better* without aggregates, confirming (a) no aggregate leakage exists, and (b) the predictive signal is fully captured by per-row transaction context. Simpler model wins.

## Evaluation

### Validation set (954,393 transactions, 1,232 fraud)

| Metric | Value |
|---|---|
| ROC-AUC | 0.999 |
| **PR-AUC** | **0.993** |
| Best net savings | $1,227,805 |
| Best threshold | 0.01 (calibrated probability) |

Per-iteration train/val curves logged to MLflow; final train AP 0.999 vs val AP 0.991 — gap of 0.008, no overfitting.

### Cost model

Net savings computed against:
- Cost per missed fraud: $1,000 (avg fraud loss)
- Cost per false positive: $5 (analyst investigation time)

These are tunable in Phase 3 via the threshold tuner UI.

### Test set

Test metrics logged to MLflow but not reviewed during model selection to preserve the test set's role as a final-evaluation holdout. Reviewed once at end of Phase 1.

## Ethical considerations

- **Synthetic data only.** The model has never seen real customer transactions. Any deployment on real data would require retraining and re-evaluation.
- **No protected attributes.** PaySim contains no demographic data — no age, race, gender, geography. Fairness audits are not possible against this dataset and would be required before real deployment.
- **Threshold tradeoffs are policy decisions.** The threshold tuner exposes precision/recall/cost tradeoffs to analyst-operators rather than baking a single policy into the model.

## Known limitations

1. **PaySim's signal is artificially clean.** Real fraud detection benchmarks publish PR-AUC of 0.3–0.7. Our 0.993 reflects the simulator's structural regularities (e.g., fraud is mechanically tied to `TRANSFER`/`CASH_OUT` with specific balance patterns), not real-world difficulty.
2. **Concept drift is not represented.** PaySim does not model evolving fraud tactics. Production deployment would require drift monitoring, addressed in Phase 4.
3. **No graph features.** Fraud rings reuse cashout accounts; a graph-aware model (sender↔receiver network embeddings) would likely outperform the current per-row approach on real data. Out of scope for v0.1.

## Reproducibility

```bash
make install            # install deps via uv
uv run dvc pull         # fetch dataset
make train              # train champion model
make mlflow-ui          # inspect runs at localhost:5000
```

All runs tagged with git SHA. Hyperparameters in `ml/training/train.py`.