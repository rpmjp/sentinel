# Data

## Dataset: PaySim

**Source:** [Kaggle — PaySim synthetic financial dataset](https://www.kaggle.com/datasets/ealaxi/paysim1)
**License:** CC-BY-SA-4.0
**Size:** 6.36M rows, 11 columns, ~471 MB CSV

PaySim is a synthetic dataset generated from a simulator based on a real mobile money service in an African country. It mimics fraudulent behavior patterns observed in production but contains no real customer data.

### Schema

| Column | Type | Description |
|---|---|---|
| `step` | int | Time unit (1 hour). Range: 1–744 (30 days). Used for temporal splitting. |
| `type` | str | Transaction type: `CASH_IN`, `CASH_OUT`, `DEBIT`, `PAYMENT`, `TRANSFER` |
| `amount` | float | Transaction amount in local currency |
| `nameOrig` | str | Sender ID |
| `oldbalanceOrg` | float | Sender balance before transaction |
| `newbalanceOrig` | float | Sender balance after transaction |
| `nameDest` | str | Receiver ID |
| `oldbalanceDest` | float | Receiver balance before transaction |
| `newbalanceDest` | float | Receiver balance after transaction |
| `isFraud` | int | Target label (1 = fraud, 0 = legit) |
| `isFlaggedFraud` | int | System flag for transfers > 200K. Dropped — leaks the target. |

### Known characteristics & biases

- **Class imbalance:** ~0.13% fraud (8,213 / 6,362,620). Severe.
- **Fraud only occurs in `TRANSFER` and `CASH_OUT`.** Other types contain zero positive labels.
- **Synthetic.** Patterns are simplified compared to real fraud — strong signals like `oldbalanceOrg == amount` are nearly deterministic for fraud cases. Real-world fraud detection sees PR-AUC of 0.3–0.7, not the >0.99 PaySim allows. This is documented as a known limitation in the model card.
- **No temporal drift in the simulator.** Production systems experience concept drift; we'll simulate drift in Phase 4 for the drift dashboard demo.

### Leakage we explicitly avoid

- `newbalanceOrig` and `newbalanceDest` — computed from the transaction itself
- `isFlaggedFraud` — system rule that already encodes fraud
- Sender aggregates computed from the full dataset — must be temporal (`step < current_step` only)

### Reproducibility

The CSV is tracked by DVC, not git. To pull:

```bash
make install
uv run dvc pull
```

For CI/CD and production, the DVC remote points to S3 (configured in `.dvc/config`).