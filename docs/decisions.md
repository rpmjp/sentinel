# Decision Log

Non-obvious choices made during the Sentinel build, with rationale. New entries appended chronologically.

## Phase 1 — Model

### D-001 · Why uv over pip + venv

Reproducible installs in 1–3s vs 30–90s for pip. Built-in lockfile (`uv.lock`). Built-in Python version management. Industry direction; signals current practice in the README.

### D-002 · Why DVC for data versioning

PaySim is 471 MB — too large for git. DVC stores the pointer in git, the file in remote storage. Standard MLOps practice; alternatives (git-LFS) don't fit ML workflows as cleanly.

### D-003 · Why Pandera for schema validation

Catches schema drift before training corrupts metrics. Cheap insurance; declarative; testable in isolation.

### D-004 · Why temporal `shift(1).expanding()` aggregates

Initial notebook computed sender stats from the full dataset, leaking future rows into current-row aggregates — a form of target leakage when computed across the train/test boundary. `shift(1).expanding()` per `nameOrig` ensures each row sees only strictly past transactions, preserving causal honesty.

### D-005 · Why stratified random split, not stratified-temporal

Started with stratified-temporal. Diagnostic analysis (see [`docs/model_card.md`](model_card.md) "Why stratified random") revealed PaySim's `step` is non-uniform simulator output, not real time. Train/val from different `step` ranges have different feature distributions → val logloss 22, val PR-AUC <0.01. Stratified random produces realistic, learnable splits. Temporal validation deferred to Phase 4 drift monitoring.

### D-006 · Why LightGBM as champion

Tree-friendly signal in PaySim, native categorical handling, fast inference (<10ms), early stopping built in. XGBoost performed comparably; LightGBM wins on inference speed for the eventual serving path.

### D-007 · Why isotonic calibration

Boosting models output ranking-good but probability-bad scores. Calibrated probabilities are required for:
- The threshold tuner (where "score > 0.7" needs to mean "70% likely fraud")
- Cost-weighted decisions
- Calibrated SHAP attributions
- Probability-based monitoring (drift in score distribution vs base rate)

Isotonic chosen over Platt (sigmoid) because the model has >10K positives in val — enough for non-parametric fit.

### D-008 · Why we dropped sender/receiver aggregates

Ablation study (no-aggregates run): val PR-AUC 0.993 vs 0.971 with aggregates. Confirms (a) no aggregate leakage, (b) per-row features capture all signal. Occam's razor: ship the simpler model.

### D-009 · Why we hide test metrics during training

Test set is only evaluated once, at the end of Phase 1, after the final model is selected. Per-run test peeking is a slow form of overfitting to the test set. Test metrics still logged to MLflow for the final report; just not printed to console.

### D-010 · Why scale_pos_weight, not SMOTE

SMOTE synthesizes fraud examples via k-NN interpolation in feature space. For fraud detection this often hurts: synthetic positives don't reflect real attacker tactics, and tree-based models handle imbalance natively via `scale_pos_weight`. Empirically confirmed in the original notebook (SMOTE underperformed `class_weight='balanced'`).

### D-011 · Cost model defaults ($1000 missed / $5 FP)

Plausible business defaults: average consumer fraud loss is in the $1K range; analyst review time at ~$50/hr × ~6 min/case ≈ $5. These are tunable per-tenant in Phase 3 via the threshold tuner. Defaults exist so the platform can demo end-to-end with a meaningful "net savings" KPI from day one.