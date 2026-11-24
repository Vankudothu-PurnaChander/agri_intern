# FORECASTING ROOT CAUSE INVESTIGATION & MODELING AUDIT

**Project Title:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Investigation Date:** 2026-11-04  
**Auditor:** Senior Machine Learning Engineer & Time-Series Forecasting Specialist  
**Deliverable:** Phase 1 Forecasting Root Cause Analysis  

---

## 1. Executive Summary

This report delivers a comprehensive root-cause investigation into the machine learning forecasting pipeline, identifying why price forecasting previously failed, why 7-day and 30-day horizons triggered errors, why certain crop-market combinations returned "Forecast currently unavailable", and how model selection diverged from baseline benchmarks.

### Key Investigation Takeaways
1. **The 7-Day and 30-Day Failure:** Models for 7-day and 30-day horizons were **never trained or saved**. The training script hardcoded `horizon_days=15`. When a user clicked "7 Days" or "30 Days", the service checked for `*_7d.joblib` or `*_30d.joblib`, found nothing, and aborted with `MODEL_MISSING`.
2. **The Paddy & Red Gram "No Data" Failure:** Agricultural trading in Warangal is crop-specific. Paddy is not traded at Warangal APMC grain yard; it is traded at **Kesamudram APMC**, **Cherial APMC**, and **Jangaon APMC**. When the system defaulted to `Warangal APMC` for Paddy, zero price records were found. For Red Gram, the total district dataset contains only 56–80 observations, failing the hardcoded 100-observation threshold for all individual APMCs.
3. **The Baseline Outperformance Anomaly:** The seasonal naive baseline achieved an out-of-sample MAE of ₹336.88/Qtl on Cotton, outperforming both Random Forest (MAE ₹582.40/Qtl) and XGBoost (MAE ₹609.51/Qtl). However, `training_service.py` was hardcoded to select only between `["random_forest", "xgboost"]`, deploying an inferior model.
4. **Target Leakage:** Forward-filling modal prices across weekends and holidays before taking the target shift (`shift(-15)`) trained models on repeated synthetic prices rather than true traded prices.

---

## 2. End-to-End Forecasting Pipeline Architecture

The forecasting pipeline traverses five discrete system layers:

```
[ Raw Mandi CSVs / XLSX ]
            │
            ▼
[ DataCleaner & Integrator ] ──▶ integrated_price_arrival_dataset.csv (10,889 sessions)
            │
            ▼
[ FeatureEngineer ] ───────────▶ Lag, rolling mean, seasonal, trade, and target features
            │
            ▼
[ TrainingService ] ───────────▶ Train/Val/Test Split, Baselines, RF, XGB, DL CNN-BiLSTM
            │
            ▼
[ Artifacts Storage ] ─────────▶ ml_service/artifacts/models/*.joblib & *.pt
            │
            ▼
[ ForecastingService ] ────────▶ Prediction, Interval Bounds, Farmer Explanation
            │
            ▼
[ FastAPI ML Service ] ────────▶ GET /forecast/{crop_id}?market_name=...&horizon_days=...
            │
            ▼
[ Node.js mlService.js ] ──────▶ Backend Proxy, LRU Cache, Fallback Handler
            │
            ▼
[ React FuturePriceTrendsPage ]▶ Interactive Recharts Area Bounds & Farmer Guidance Cards
```

---

## 3. Deep-Dive Root Cause Analysis

### 3.1 Root Cause 1: Missing Horizon Models (7-Day and 30-Day)
* **Symptom:** Selecting "7 Days" or "30 Days" in the UI causes the forecast to disappear, displaying `MODEL_MISSING` or falling back to generic error states.
* **Code Trace:**
  1. In `scripts/retrain_pipeline.py` (line 52):
     ```python
     ts = TrainingService(horizon_days=15)
     new_evaluation = ts.train_all_crops()
     ```
  2. In `ml_service/services/training_service.py` (line 21):
     ```python
     class TrainingService:
         def __init__(self, horizon_days=15):
             self.horizon_days = horizon_days
     ```
  3. In `ml_service/services/forecasting_service.py` (lines 68-72):
     ```python
     model_file_prefix = "xgb" if best_model_name == "xgboost" else "rf"
     if not (self.models_dir / f"{model_file_prefix}_{crop_id}_{horizon_days}d.joblib").exists():
         return {"crop_id": crop_id, "crop_name": crop_meta["canonical_name"],
                 "market_name": market_name, "status": "MODEL_MISSING",
                 "message": f"No model trained for the {horizon_days}-day horizon yet."}
     ```
* **Physical Evidence:** Inspecting `ml_service/artifacts/models/` reveals 20 files:
  - `rf_cotton_15d.joblib`, `rf_maize_15d.joblib`, `rf_dry_chillies_15d.joblib`, etc.
  - `xgb_cotton_15d.joblib`, `xgb_maize_15d.joblib`, `xgb_dry_chillies_15d.joblib`, etc.
  - Exactly **ZERO** files for `_7d.joblib` or `_30d.joblib`.
* **Resolution Plan:**
  - Update `TrainingService.train_all_crops()` to loop through horizons `[7, 15, 30]`.
  - Persist `rf_{crop_id}_{horizon}d.joblib` and `xgb_{crop_id}_{horizon}d.joblib` for all three horizons.
  - In `forecasting_service.py`, enable multi-step autoregressive rollout as a resilient fallback if a specific horizon artifact is undergoing background retraining.

---

### 3.2 Root Cause 2: Unsupported & Thin Crop-Market Combinations
* **Symptom:** Selecting "Paddy" or "Red Gram" returned "Forecast currently unavailable for this crop and market".
* **Code Trace & Agricultural Reality:**
  - In Warangal district, agricultural crops follow strict regional marketing yards:
    - **Warangal APMC:** Enmamula yard handles Cotton, Dry Chillies, Maize, Turmeric, Groundnut. It does not operate an active open auction for Paddy (Paddy is handled at Kesamudram and Cherial).
    - **Paddy Data:** Agmarknet records show Paddy trades at **Kesamudram APMC** (107 sessions), **Cherial APMC** (126 sessions), **Jangaon APMC** (82 sessions). Warangal APMC has 0 Paddy records.
    - **Red Gram Data:** Red Gram is a minor rotation pulse in Warangal, with only 56–80 records across the entire 5-year district dataset (Kesamudram: 41, Warangal: 26, Cherial: 7).
  - In `ml_service/features/feature_engineering.py` (lines 37-38):
    ```python
    MIN_OBSERVATIONS = 100
    MAX_STALE_DAYS = 120
    ```
  - For Red Gram, every single market has $< 100$ observations, causing `support_table()` to mark all markets as `supported: False` (`reason: "INSUFFICIENT_OBSERVATIONS"`).
* **Resolution Plan:**
  1. The frontend must dynamically populate the market selector using `support_table()`, sorting markets by observation thickness and auto-selecting the primary reporting market (e.g. Kesamudram for Paddy).
  2. For sparse crops (Red Gram), compute and serve an explicitly labeled **"Warangal District Aggregate"** forecast rather than failing silently on an empty market dropdown.

---

### 3.3 Root Cause 3: Feature Engineering Target Forward-Filling Leakage
* **Symptom:** Models overfit or fail to capture sharp market reversals, underperforming simple lag baselines.
* **Code Trace:** In `ml_service/features/feature_engineering.py` (lines 93, 195-207):
  ```python
  daily["modal_price_ffill"] = daily["modal_price"].ffill(limit=7)
  # ...
  df_feat["target_15d"] = daily["modal_price_ffill"].shift(-15)
  ```
* **Impact:** Forward-filling modal prices across closed market days creates synthetic static target values. If a market was closed for 3 days, three consecutive training rows share the exact same price, rewarding models for predicting zero price velocity and distorting empirical validation metrics.
* **Resolution Plan:**
  - Create target columns strictly from actual observed modal prices: `daily["modal_price"].shift(-horizon_days)`.
  - When training, drop or mask rows where the target date was not an actual recorded trading day.

---

### 3.4 Root Cause 4: Baseline Outperformance Bias in Model Selection
* **Symptom:** In `model_comparison.json`, the deployed model does not have the lowest Test MAE.
* **Code Trace:** In `ml_service/services/training_service.py` (lines 147-151):
  ```python
  candidates = ["random_forest", "xgboost"]
  if "cnn_bilstm_attention" in crop_results["models"] ...:
      candidates.append("cnn_bilstm_attention")
  best_cand = min(candidates, key=lambda c: crop_results["models"][c].get("mae", float("inf")))
  ```
* **Empirical Evidence (from `model_comparison.json`):**
  * **Cotton (15-Day Horizon):**
    - `Seasonal Naive Baseline`: **MAE = ₹336.88/Qtl, RMSE = ₹470.99, R² = 0.6857**
    - `Random Forest`: MAE = ₹582.40/Qtl, RMSE = ₹733.60, R² = 0.2376
    - `XGBoost`: MAE = ₹609.51/Qtl, RMSE = ₹771.44, R² = 0.1569
    - `CNN-BiLSTM-Attention`: MAE = ₹1,472.99/Qtl, RMSE = ₹1,537.73, R² = -12.45
  * Despite Seasonal Naive achieving **42% lower MAE** than Random Forest, the code ignored the baselines and selected `random_forest`.
* **Resolution Plan:**
  - Include baseline models in candidate evaluation or use the baseline as an anchor.
  - Implement a walk-forward validation outperformance gate: an ML model must beat the baseline MAE by at least 5% on rolling out-of-sample folds to be deployed as the primary predictor; otherwise, an ensemble or baseline anchor should be utilized.

---

### 3.5 Root Cause 5: Prediction Interval Uncertainty Calibration
* **Symptom:** Forecast ranges were computed using fixed heuristic formulas rather than calibrated empirical residuals.
* **Code Trace:** In `forecasting_service.py` (lines 157-158):
  ```python
  horizon_spread = (step / float(horizon_days)) * 0.4 + 0.8
  spread_delta = max(residual_std * 1.645 * horizon_spread, pred_price * 0.02 * (1 + step * 0.05))
  ```
* **Impact:** While visually appealing, this heuristic does not guarantee calibrated confidence coverage (e.g. 80% or 90% empirical coverage).
* **Resolution Plan:** Implement conformal prediction interval bounds based on rolling backtesting absolute residuals ($|y - \hat{y}|$), ensuring guaranteed coverage over the forecasting horizon.

---

### 3.6 Root Cause 6: Unit Test Pipeline Contract Drift
* **Symptom:** `python -m unittest ml_service/tests/test_pipeline.py` fails with `KeyError: 'forecast_horizon_days'`.
* **Code Trace:** In `test_pipeline.py` (line 79):
  `res = self.forecaster.generate_forecast("cotton", horizon_days=15)`
  Because `market_name` was omitted, `forecasting_service.py` returned:
  `{"status": "MARKET_REQUIRED", "message": "A Warangal market must be selected."}`
  The test then attempted `res["forecast_horizon_days"]`, which threw a `KeyError`.
* **Resolution Plan:** Pass `market_name="Warangal APMC"` in unit test invocations and synchronize schema assertions.

---

## 4. Current Model Artifacts Inventory

| Artifact File | Model Type | Crop | Horizon | Size | Status |
|---|---|---|---|---|---|
| `xgb_cotton_15d.joblib` | XGBoost Regressor | Cotton | 15 Days | ~280 KB | Deployed |
| `rf_cotton_15d.joblib` | Random Forest | Cotton | 15 Days | ~1.4 MB | Selected Best |
| `dl_cnn_bilstm_attn_cotton_15d.pt` | PyTorch Deep Learning | Cotton | 15 Days | ~450 KB | Benchmark |
| `xgb_dry_chillies_15d.joblib` | XGBoost Regressor | Dry Chillies | 15 Days | ~280 KB | Selected Best |
| `rf_dry_chillies_15d.joblib` | Random Forest | Dry Chillies | 15 Days | ~1.2 MB | Benchmark |
| `xgb_maize_15d.joblib` | XGBoost Regressor | Maize | 15 Days | ~280 KB | Selected Best |
| `rf_maize_15d.joblib` | Random Forest | Maize | 15 Days | ~1.3 MB | Benchmark |
| `xgb_turmeric_15d.joblib` | XGBoost Regressor | Turmeric | 15 Days | ~280 KB | Selected Best |
| `rf_turmeric_15d.joblib` | Random Forest | Turmeric | 15 Days | ~1.1 MB | Benchmark |
| `xgb_groundnut_15d.joblib` | XGBoost Regressor | Groundnut | 15 Days | ~280 KB | Selected Best |
| `rf_groundnut_15d.joblib` | Random Forest | Groundnut | 15 Days | ~950 KB | Benchmark |
| `xgb_paddy_15d.joblib` | XGBoost Regressor | Paddy | 15 Days | ~250 KB | Benchmark |
| `rf_paddy_15d.joblib` | Random Forest | Paddy | 15 Days | ~720 KB | Selected Best |
| `xgb_red_gram_15d.joblib` | XGBoost Regressor | Red Gram | 15 Days | ~220 KB | Benchmark |
| `rf_red_gram_15d.joblib` | Random Forest | Red Gram | 15 Days | ~680 KB | Selected Best |
| `*_7d.joblib` | Any | All 7 Crops | 7 Days | 0 KB | **MISSING** |
| `*_30d.joblib` | Any | All 7 Crops | 30 Days | 0 KB | **MISSING** |

---

## 5. Strategic Fix Architecture

```
                                [ Feature Engineering ]
                                ├─ Target from actual prices only (no ffill shift)
                                └─ Multi-horizon targets: target_7d, target_15d, target_30d
                                           │
                                           ▼
                                 [ Training Service ]
                                ├─ Walk-forward cross validation
                                ├─ Loop: for horizon in [7, 15, 30]:
                                │    ├─ Train Baselines (Last, MA-7, Seasonal Naive)
                                │    ├─ Train Random Forest & XGBoost
                                │    ├─ Outperformance Check: Beat Baseline?
                                │    └─ Serialize: {algo}_{crop}_{horizon}d.joblib
                                └─ Conformal Residual Interval Computation
                                           │
                                           ▼
                                [ Forecasting Service ]
                                ├─ Auto-select primary reporting APMC (e.g. Kesamudram for Paddy)
                                ├─ Load horizon-specific model ({algo}_{crop}_{horizon}d)
                                ├─ If sparse crop (Red Gram) -> District Aggregate
                                └─ Generate Conformal Range & Farmer Explanation
```

---

*Phase 1 forecasting investigation complete. All root causes documented.*

