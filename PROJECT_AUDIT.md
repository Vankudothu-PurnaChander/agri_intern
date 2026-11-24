# PROJECT AUDIT: WARANGAL AGRICULTURE MARKET INTELLIGENCE & PRICE FORECASTING SYSTEM

**Project Title:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Investigation Date:** 2026-11-04  
**Auditor:** Senior Full-Stack, Machine Learning & Agricultural Data Engineering Specialist  
**Investigation Scope:** Phase 1 Complete Audit — Read-Only Project Codebase, Architecture, Data Pipelines, Database State, and Forecasting Infrastructure  

---

## 1. Executive Summary

The **Warangal Agriculture Market Intelligence and Price Forecasting System** is a full-stack decision-support platform designed specifically for farmers, traders, and agricultural stakeholders in the Warangal region of Telangana, India.

The project encompasses:
1. **Frontend:** React 19 + Vite 6 + Tailwind CSS single-page application with bilingual support (English and Telugu), responsive data visualizations via Recharts, and graceful multi-state boundaries.
2. **Backend:** Node.js (v22) + Express (v5) REST API server with high-throughput query caching, covered database indexes, and transparent fallbacks between MongoDB Atlas and local processed CSVs.
3. **Database:** MongoDB Atlas Cloud database (`warangal_agrimarket` on shard cluster `ac-d8tcg8s`) containing 14,056 historical price records, 326 arrival records, 56 national trade records, and 19 statistical correlation pairs.
4. **Machine Learning Microservice:** Python FastAPI microservice providing feature engineering, time-series baselines, tree-based regressors (Random Forest, XGBoost), deep learning architectures (CNN-BiLSTM-Attention), and multi-horizon price forecasting.

### Current Overall Health Assessment
* **Core Data Loading & Querying:** **EXCELLENT / FUNCTIONAL.** Backend routes respond in < 15ms when cached and < 85ms on indexed Atlas queries.
* **Frontend Navigation & Presentation:** **EXCELLENT / FUNCTIONAL.** All 5 modules (Dashboard, Current Prices, Market Arrivals, Mandi Comparison, Future Price Trends) are responsive, visually coherent, and free of syntax/build errors.
* **Bilingual Localization:** **EXCELLENT / FUNCTIONAL.** Complete dictionary in `frontend/src/i18n/translations.js` supporting instant switching between English and Telugu without re-fetching.
* **Forecasting Pipeline:** **PARTIALLY FUNCTIONAL / REQUIRES REMEDIATION.** While the 15-day forecast works for supported markets, multi-horizon selection (7-day and 30-day) fails with `MODEL_MISSING` because candidate training was hardcoded to 15 days only. Additionally, baseline model selection biased toward tree models despite Seasonal Naive achieving superior MAE on certain crops.

---

## 2. Complete Project Architecture & Component Inventory

```
agri_intern/
├── backend/                             # Node.js + Express REST API Server (Port 5000)
│   ├── config/
│   │   ├── crops.js                     # Centralized crop definitions (7 crops) & 12 APMC markets
│   │   └── db.js                        # MongoDB Atlas connection manager with health pooling
│   ├── controllers/
│   │   ├── analysisController.js        # Price-arrival correlation & lag endpoints
│   │   ├── arrivalController.js         # Daily arrival records & history
│   │   ├── comparisonController.js      # Multi-mandi price comparison across Warangal APMCs
│   │   ├── dashboardController.js       # Executive summaries & crop cards overview
│   │   ├── dataController.js            # Ingestion & daily trigger endpoints
│   │   ├── forecastController.js        # Horizon forecasting, support tables & evaluations
│   │   └── priceController.js           # Latest prices, today's prices, and 30-day history
│   ├── models/
│   │   ├── Arrival.js                   # Mongoose schema for daily arrivals
│   │   ├── CollectionLog.js             # Mongoose schema for data ingestion audit logs
│   │   ├── Correlation.js               # Mongoose schema for Pearson/Spearman/Granger results
│   │   ├── Price.js                     # Mongoose schema for mandi prices (compound indexed)
│   │   ├── PriceForecast.js             # Mongoose schema for persisted forecast predictions
│   │   └── Trade.js                     # Mongoose schema for national export/import metrics
│   ├── routes/                          # Express route definitions matching controllers
│   ├── services/
│   │   ├── cacheService.js              # In-memory LRU + Redis cache manager with TTL
│   │   ├── dataSyncService.js           # Hybrid query engine (Atlas -> Memory fallback)
│   │   └── mlService.js                 # HTTP client to Python FastAPI with execSync fallback
│   ├── package.json                     # Express 5.3, Mongoose 9.11, Axios 1.21, Helmet, Cors
│   └── server.js                        # Express server entry point
├── Datasets/                            # Raw and Processed Datasets
│   ├── cotton_tg(2021-2026).csv         # Raw mandi prices for Cotton (4,448 rows)
│   ├── drychilli_tg(2021-2026).xlsx     # Raw mandi prices for Dry Chillies (3,375 rows)
│   ├── groundnut_tg(2021-2026).csv      # Raw mandi prices for Groundnut (1,079 rows)
│   ├── maize_tg(2021-2026).csv          # Raw mandi prices for Maize (3,191 rows)
│   ├── paddy_tg(2021-2026.csv           # Raw mandi prices for Paddy (406 rows)
│   ├── redgram_tg(2021-2026).csv        # Raw mandi prices for Red Gram (56 rows)
│   ├── turmeric_tg(2021-2026).csv       # Raw mandi prices for Turmeric (1,983 rows)
│   ├── *_export*.xlsx / *_import*.xlsx  # 28 DGCIS national trade commodity tables
│   ├── processed/
│   │   ├── arrivals/cleaned_arrivals_all.csv
│   │   ├── integrated/
│   │   │   ├── correlation_results.json # 19 crop-market statistical correlation records
│   │   │   ├── integrated_price_arrival_dataset.csv # 10,889 unique market-day sessions
│   │   │   └── integrated_trade_dataset.csv
│   │   ├── prices/cleaned_prices_all.csv            # 14,056 cleaned price records
│   │   └── trade/cleaned_trade_all.csv              # 56 normalized fiscal year trade records
│   └── reports/                         # Cleaning reports, profile summaries, rejected records
├── frontend/                            # React 19 + Vite 6 Single Page Application (Port 5173)
│   ├── src/
│   │   ├── components/
│   │   │   ├── CropCard.jsx             # Crop summary card on dashboard
│   │   │   ├── DataStateView.jsx        # Universal boundary (Loading, Empty, Error, Content)
│   │   │   ├── Layout.jsx               # App container with Navbar & Sidebar
│   │   │   ├── Navbar.jsx               # Header with language toggle and branding
│   │   │   ├── Sidebar.jsx              # Navigation menu for 5 primary modules
│   │   │   └── StatCard.jsx             # Key metric display cards
│   │   ├── context/
│   │   │   └── LanguageContext.jsx      # React Context for English / Telugu state
│   │   ├── i18n/
│   │   │   └── translations.js          # Bilingual translation dictionary (EN/TE)
│   │   ├── pages/
│   │   │   ├── CurrentPricesPage.jsx    # Module 2: Latest prices, today's prices, 30d chart
│   │   │   ├── DashboardPage.jsx        # Module 1: Executive district summary & crop cards
│   │   │   ├── FuturePriceTrendsPage.jsx# Module 5: 7/15/30d forecasts & farmer guidance
│   │   │   ├── MandiComparisonPage.jsx  # Module 4: Price spread across Warangal APMCs
│   │   │   └── MarketArrivalsPage.jsx   # Module 3: Daily arrivals & correlation cards
│   │   ├── services/
│   │   │   └── api.js                   # Axios client with request deduplication & memory cache
│   │   ├── App.jsx                      # React Router configuration
│   │   └── main.jsx                     # Vite entry point
├── ml_service/                          # Python ML & Statistical Microservice (FastAPI Port 8000)
│   ├── analysis/
│   │   └── correlation.py               # Pearson, Spearman, Granger Causality & Lag analysis
│   ├── app/
│   │   ├── main.py                      # FastAPI application with CORS and route mounting
│   │   └── routes/
│   │       ├── analysis.py              # Statistical correlation & lag API endpoints
│   │       ├── forecast.py              # Forecast prediction & horizon API endpoints
│   │       └── training.py              # Asynchronous model retraining endpoints
│   ├── artifacts/
│   │   ├── evaluation/
│   │   │   ├── model_comparison.csv     # Master benchmark comparison table across crops
│   │   │   └── model_comparison.json    # Complete metrics (MAE, RMSE, MAPE, sMAPE, R²)
│   │   ├── models/                      # Trained model artifacts (.joblib, .pt)
│   │   └── scalers/                     # Deep learning feature MinMax scalers
│   ├── data/
│   │   ├── cleaner.py                   # Data cleaning, outlier bounds & date standardization
│   │   ├── integrator.py                # Dataset integration engine (outer join prices & arrivals)
│   │   ├── loader.py                    # Dataset loading utilities
│   │   └── validator.py                 # Agricultural logic validation rules
│   ├── evaluation/
│   │   ├── backtesting.py               # Walk-forward cross validation harness
│   │   └── metrics.py                   # MAE, RMSE, MAPE, sMAPE, R2, Directional Accuracy
│   ├── features/
│   │   └── feature_engineering.py       # Backward-looking lag, rolling, seasonal, trade features
│   ├── models/
│   │   ├── baseline.py                  # Last Observed, 7-day MA, Seasonal Naive baselines
│   │   ├── cnn_bilstm_attention.py      # PyTorch Deep Learning architecture
│   │   ├── random_forest.py             # Scikit-Learn Random Forest Regressor
│   │   └── xgboost_model.py             # XGBoost Regressor
│   ├── services/
│   │   ├── forecasting_service.py       # End-to-end inference, bounds, farmer explanation
│   │   └── training_service.py          # Chronological split training & evaluation engine
│   └── tests/
│       └── test_pipeline.py             # Automated unit tests for data cleaning & inference
└── scripts/                             # Utility & Automation Scripts
    ├── bulk_loader.py                   # Batch loader from raw CSV to processed/MongoDB
    ├── create_indexes.js                # MongoDB covered index creation script
    ├── daily_collector.py               # Agmarknet daily scraping & ingestion script
    ├── inspect_datasets.py              # Dataset profiling & quality auditing script
    ├── load_correlations.js             # Statistical correlation loader to Atlas
    └── retrain_pipeline.py              # Periodic model retraining & candidate evaluation
```

---

## 3. Module-by-Module Audit

| Module | Route / Page | Implementation Status | Functional Quality | Findings & Issues |
|---|---|---|---|---|
| **1. Executive Dashboard** | `/` (`DashboardPage.jsx`) | **Operational** | **High** | Real data loaded from `/api/dashboard/summary` and `/api/dashboard/crop-overview`. Displays total reporting mandis, top traded crop, latest price records count, and 7 crop cards. Navigation buttons link to `/prices` and `/forecast`. |
| **2. Current Market Prices** | `/prices` (`CurrentPricesPage.jsx`) | **Operational** | **High** | Dual toggle ('Latest Available' vs 'Today's Prices Only'). When market reports are not yet published for today, clear banner explains trading timing rather than breaking table. 30-day historical line chart displays Max, Min, Modal price series with fixed tooltip series formatting. |
| **3. Market Arrivals** | `/arrivals` (`MarketArrivalsPage.jsx`) | **Operational** | **High** | Bar chart plots chronological arrivals with explicit non-reporting day gap handling (`calendarChartData`). Summary cards compute average daily volume without treating non-reporting days as zero. Displays Statistical Price-Arrival Relationship card with correlation coefficient, lag impact, and Granger causality explanation. |
| **4. Mandi Comparison** | `/mandi-comparison` (`MandiComparisonPage.jsx`) | **Operational** | **High** | Compares modal prices across reporting Warangal APMCs for selected crop. Highlights highest price mandi with badge and computed difference to district average. |
| **5. Future Price Trends** | `/forecast` (`FuturePriceTrendsPage.jsx`) | **Partially Operational** | **Medium** | 15-day forecast displays successfully for high-thickness markets. Farmer explanation and actionable guidance rendered clearly without technical jargon. **Issue:** 7-day and 30-day buttons trigger `MODEL_MISSING` because models were only trained for 15 days. Thin crops like Red Gram have no supported markets under current 100-observation threshold. |

---

## 4. Comprehensive Problem & Gap Matrix

### Problem 1: Hardcoded 15-Day Training Horizon in ML Pipeline
* **Problem:** Only 15-day models (`xgb_*_15d.joblib`, `rf_*_15d.joblib`) were trained and serialized in `ml_service/artifacts/models/`. No models exist for 7-day or 30-day forecasting horizons.
* **Root Cause:** Both `scripts/retrain_pipeline.py` (line 52) and `ml_service/services/training_service.py` (line 21) instantiate `TrainingService(horizon_days=15)` without iterating through required horizons (7, 15, 30).
* **Affected Files:**
  * `ml_service/services/training_service.py`
  * `scripts/retrain_pipeline.py`
  * `ml_service/app/routes/training.py`
* **Evidence:** Listing `ml_service/artifacts/models/` reveals exactly 20 files, all ending in `_15d.joblib` or `_15d.pt`. Zero `_7d.*` or `_30d.*` files exist.
* **Recommended Fix:** Refactor `TrainingService.train_all_crops()` and `RetrainingPipeline` to iterate across `[7, 15, 30]` horizons and persist horizon-specific models.
* **Dependencies:** Feature engineering must support multi-horizon targets (`target_7d`, `target_15d`, `target_30d`).
* **Risk of Modification:** Low. Clean addition of multi-horizon loop during model training.

---

### Problem 2: UI "Model Missing" Failure on 7-Day and 30-Day Horizons
* **Problem:** In the frontend "Future Price Trends" page, clicking the "7 Days" or "30 Days" buttons results in `MODEL_MISSING: No model trained for the 7-day/30-day horizon yet.`
* **Root Cause:** `ForecastingService.generate_forecast()` in `ml_service/services/forecasting_service.py` (lines 69-72) checks whether `f"{model_file_prefix}_{crop_id}_{horizon_days}d.joblib"` exists. Because 7d and 30d were never trained, the check fails and returns `status: "MODEL_MISSING"`.
* **Affected Files:**
  * `ml_service/services/forecasting_service.py`
  * `frontend/src/pages/FuturePriceTrendsPage.jsx`
* **Evidence:** Manual request `GET /forecast/cotton?market_name=Warangal%20APMC&horizon_days=7` returns:
  `{"status": "MODEL_MISSING", "message": "No model trained for the 7-day horizon yet."}`
* **Recommended Fix:** Train and serialize models for 7, 15, and 30 days. In addition, allow autoregressive dynamic simulation as a resilient backup if a horizon artifact is being updated.
* **Dependencies:** Completion of Problem 1.
* **Risk of Modification:** Low.

---

### Problem 3: Model Selection Ignored Baseline Outperformance
* **Problem:** For certain crops (e.g., Cotton), the simple `Seasonal Naive` baseline achieved a Test MAE of ₹336.88/Qtl, significantly beating both `Random Forest` (MAE ₹582.40/Qtl) and `XGBoost` (MAE ₹609.51/Qtl). However, `training_service.py` selected `random_forest` as the deployed model.
* **Root Cause:** In `ml_service/services/training_service.py` (line 147), candidate models for selection were hardcoded to `candidates = ["random_forest", "xgboost"]`. Baselines were computed for telemetry but explicitly excluded from candidate selection. Furthermore, the tree models were trained on single arbitrary train/val/test splits rather than walk-forward rolling splits.
* **Affected Files:**
  * `ml_service/services/training_service.py`
  * `ml_service/artifacts/evaluation/model_comparison.json`
* **Evidence:** In `ml_service/artifacts/evaluation/model_comparison.json`:
  ```json
  "cotton": {
    "models": {
      "seasonal_naive": { "mae": 336.88, "rmse": 470.99, "r2": 0.6857 },
      "random_forest": { "mae": 582.4, "rmse": 733.6, "r2": 0.2376 },
      "xgboost": { "mae": 609.51, "rmse": 771.44, "r2": 0.1569 }
    },
    "best_model_name": "random_forest"
  }
  ```
* **Recommended Fix:** Implement outperformance validation gate in `training_service.py`. If a trained ML model cannot beat the seasonal naive baseline in walk-forward evaluation, either hyperparameter-tune the ML model with lag tuning or ensemble with baseline rather than silently deploying an inferior model.
* **Dependencies:** Feature engineering refinements and walk-forward cross validation.
* **Risk of Modification:** Medium. Requires retraining models across crops.

---

### Problem 4: Target Forward-Filling Data Leakage in Feature Engineering
* **Problem:** During feature construction, missing prices across non-trading days were forward-filled up to 7 days, and then target variables were created using `.shift(-horizon_days)` on the forward-filled price column (`modal_price_ffill`).
* **Root Cause:** In `ml_service/features/feature_engineering.py` (lines 93, 195-207):
  `daily["modal_price_ffill"] = daily["modal_price"].ffill(limit=7)`
  `df_feat["target_15d"] = daily["modal_price_ffill"].shift(-15)`
  This causes the model to predict synthetic repeated forward-filled prices rather than actual traded prices, distorting evaluation metrics and dampening true price volatility.
* **Affected Files:**
  * `ml_service/features/feature_engineering.py`
* **Evidence:** Line 197 of `feature_engineering.py`: `df_feat["target_15d"] = daily["modal_price_ffill"].shift(-15)`.
* **Recommended Fix:** Calculate target values strictly from actual reported modal prices (`daily["modal_price"].shift(-horizon_days)`). When evaluating and training, mask or drop rows where the target date was not an actual trading day, or evaluate only on verified market sessions.
* **Dependencies:** Model retraining pipeline.
* **Risk of Modification:** Medium. Modifies training data targets; will alter evaluation numbers towards true empirical performance.

---

### Problem 5: Thin Historical Observations for Red Gram & Paddy Market Selection
* **Problem:** When a farmer selects "Red Gram" in the Future Price Trends page, the market dropdown is empty and displays: *"No Warangal market has enough recent price history for a forecast of this crop."* Similarly, Paddy at Warangal APMC returns no data because Paddy in Warangal district trades at Kesamudram, Cherial, and Jangaon.
* **Root Cause:** 
  1. `FeatureEngineer.support_table()` enforces `MIN_OBSERVATIONS = 100`. In the historical dataset, Red Gram only has 1 to 41 observations per individual APMC yard (district total is 56–80 observations).
  2. The frontend initially defaulted market to `Warangal APMC` for all crops, even though Paddy is traded at `Kesamudram APMC` and `Cherial APMC`.
* **Affected Files:**
  * `ml_service/features/feature_engineering.py`
  * `ml_service/services/forecasting_service.py`
  * `frontend/src/pages/FuturePriceTrendsPage.jsx`
* **Evidence:** In `support_table()` output:
  - `red_gram Kesamudram APMC`: 41 observations (`INSUFFICIENT_OBSERVATIONS`)
  - `red_gram Warangal APMC`: 26 observations (`INSUFFICIENT_OBSERVATIONS`)
  - `paddy Warangal APMC`: 0 observations (Paddy trades at Kesamudram: 107, Cherial: 126).
* **Recommended Fix:** 
  1. Automatically default the market selector to the highest-volume reporting APMC for the selected crop (e.g., Kesamudram for Paddy).
  2. For crops with sparse market-level records like Red Gram, provide a clearly labeled "Warangal District Aggregate" forecast while maintaining transparent minimum-sample notices.
* **Dependencies:** Support table API integration.
* **Risk of Modification:** Low. Enhances farmer usability without fabricating data.

---

### Problem 6: Unit Test Suite Contract Drift (`test_pipeline.py`)
* **Problem:** Running `python -m unittest ml_service/tests/test_pipeline.py` fails with `KeyError: 'forecast_horizon_days'` in `test_forecasting_service_output`.
* **Root Cause:** In `test_pipeline.py` (line 79), `self.forecaster.generate_forecast("cotton", horizon_days=15)` is invoked without passing `market_name`. In `forecasting_service.py` (line 49), if `market_name` is missing, it returns `{"status": "MARKET_REQUIRED"}`, which does not contain the key `"forecast_horizon_days"`. Furthermore, line 92 of `test_pipeline.py` asserts `future_part[-1]["predicted_modal_price"]`, but the actual schema key is `"expected_mid"`.
* **Affected Files:**
  * `ml_service/tests/test_pipeline.py`
* **Evidence:** Test execution output:
  ```
  ERROR: test_forecasting_service_output (ml_service.tests.test_pipeline.TestAgriculturalPipeline)
  KeyError: 'forecast_horizon_days'
  FAILED (errors=1)
  ```
* **Recommended Fix:** Update `test_pipeline.py` to pass `market_name="Warangal APMC"` and align key assertions (`"expected_mid"`, `"lower_bound"`, `"upper_bound"`) with the actual forecasting response schema.
* **Dependencies:** None.
* **Risk of Modification:** Low. Restores CI/CD regression test validity.

---

### Problem 7: Multi-Horizon API Routes Outdated Horizon Specifications
* **Problem:** In `ml_service/app/routes/forecast.py` (lines 41-48) and `backend/services/mlService.js` (lines 69-72), multi-horizon endpoints query horizons `[15, 30, 60, 90]` instead of the required horizons `[7, 15, 30]`.
* **Root Cause:** Legacy code from an initial exploratory specification that used 60 and 90 day horizons before the project scope was refined to 7, 15, and 30 days for farmer utility.
* **Affected Files:**
  * `ml_service/app/routes/forecast.py`
  * `backend/services/mlService.js`
* **Evidence:** Lines 46-47 in `ml_service/app/routes/forecast.py`:
  `horizons = [15, 30, 60, 90]`
* **Recommended Fix:** Standardize horizon array to `[7, 15, 30]` across all backend and ML routes.
* **Dependencies:** Problem 1 completion.
* **Risk of Modification:** Low.

---

## 5. Summary of Audit Findings & Verification Status

| Item / Subsystem | Current State | Verification Method | Action Required in Plan |
|---|---|---|---|
| **Raw Datasets (7 Crops)** | Intact, uncorrupted, verified | CSV/XLSX file inspection | Preserved as immutable source of truth |
| **Processed Prices** | 14,056 records, 429 rejected | Script & DB inspection | Documented in `DATA_AUDIT.md` |
| **Processed Arrivals** | 326 records, 545 sample entries | Script & DB inspection | Documented in `DATA_AUDIT.md` |
| **National Trade Data** | 56 records across 5 fiscal years | Script & DB inspection | Documented in `DATA_AUDIT.md` |
| **MongoDB Atlas** | Connected, 5 active collections | Cloud Node script query | Documented in `DATABASE_AUDIT.md` |
| **Backend API Server** | Port 5000, 7 route modules | Direct in-memory & HTTP tests | Detailed in `API_DOCUMENTATION.md` |
| **Frontend SPA** | React 19, Vite 6, 0 build errors | `npm run build` | Verified |
| **ML Models (15d)** | 20 models & scalers serialized | File system & JSON audit | Retain baseline comparison |
| **ML Models (7d, 30d)** | Missing | File system & JSON audit | Train in Phase 7 |
| **Pipeline Unit Tests** | 1 failing test (contract mismatch) | `python -m unittest` | Align schema in Phase 12 |

---

*Phase 1 investigation concluded. No project files have been modified. Implementation plan is detailed in `IMPLEMENTATION_PLAN.md`.*

