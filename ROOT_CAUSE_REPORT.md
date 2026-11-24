# Root Cause Report: "Forecast currently unavailable for this crop and market"

Scope: read-only investigation. No code was modified. Evidence comes from running `ForecastingService.generate_forecast` directly and from profiling `Datasets/processed/integrated/integrated_price_arrival_dataset.csv` (10,889 rows, 2021-11-01 to 2026-11-01).

Not yet verified: the live MongoDB state, the running Express API, the FastAPI service over HTTP, and the browser UI. Those are Phase 1 follow-ups.

## Direct test results (Python service)

| Crop | Market | Horizon | Result |
|---|---|---|---|
| Cotton | Warangal APMC | 7 | SUCCESS (8877-9370) |
| Cotton | Warangal APMC | 30 | SUCCESS (8658-9569) |
| Paddy | Warangal APMC | 15 | **INSUFFICIENT_DATA**, "No historical price records found for this market." |
| Paddy | Kesamudram APMC | 15 | SUCCESS (2194-2668) |
| Red Gram | Warangal APMC | 15 | SUCCESS (7006-7514) |
| Maize | Mahabubabad APMC | 15 | SUCCESS (1687-2160) |

## Root causes

1. **Unsupported crop-market combinations are not filtered out.**
   - The dataset has no Paddy rows for Warangal APMC. Paddy appears only at Cherial, Jangaon, Kamalapur, Kesamudram, Mahabubabad and Mulugu, and only from 2025-11 onward.
   - `mlService.getForecast` defaults the market to `'Warangal APMC'`.
   - `FeatureEngineer.build_features_for_crop` returns an empty frame for a missing pair, and the service returns `INSUFFICIENT_DATA`.
   - The frontend turns that into the generic "unavailable" message.
   - The backend never checks whether the pair is supported, so the UI offers markets that cannot be forecast.
2. **Many pairs are too thin to forecast.**
   - Red Gram has 1 to 41 rows per market.
   - Paddy has 11 to 126 rows per market.
   - Dry Chillies at Mulugu has 6 rows and at Thorrur has 1.
   - Cotton at Cherial has 1 row.
   - There is no minimum-observation rule, so these pairs either fail or produce meaningless output.
3. **Errors are hidden.**
   - The controllers return a generic 500.
   - `mlService.js` catches every HTTP failure and silently shells out to `python -c` through `execSync`, with a 25 s timeout and string-interpolated input.
   - On failure it returns `status: 'ERROR'`, so the frontend cannot tell "no data" from "service down".
   - Failures from the Python service and from missing models are indistinguishable.
4. **Horizon handling is wrong.**
   - Only `*_15d` models exist in `ml_service/artifacts/models`. Models for 7 and 30 days were never trained.
   - `forecasting_service.py` falls back to the 15d model file for 7 and 30 days, so those forecasts do not use a model trained for that target.
   - The `/horizons` endpoint, the `mlService.js` fallback and the forecast route use 15/30/60/90 days. The product requires 7/15/30.
5. **Model coverage is incomplete.**
   - No DL model exists for red_gram (DL is not required).
   - The model is per crop, not per market, so market identity is only partly captured.
   - For some crops the saved "best" model does not beat the baselines. Cotton's Seasonal Naive has MAE 337 against 582 for Random Forest, which is the selected model. Selection is not based on out-of-sample performance against the baselines.
6. **Prediction intervals are not validated.** Intervals are ŷ ± z·σ_h. No coverage is measured, which violates the requirement for calibrated or conformal intervals.
7. **Data-handling violations in feature engineering.**
   - Missing arrivals are filled with 0 (`arrival_qty_clean`) and arrival quantities are summed.
   - Missing trade features are filled with 0.
   - Prices are forward-filled up to 7 days, including in the target (`target_*` is shifted from `modal_price_ffill`).
   - Early lags are filled from `price_lag_1`.
   - A missing-arrival flag exists and should be kept.

## Planned fixes
- Add a supported-combinations endpoint, computed from the data with a minimum-observation threshold, and have the market dropdown use it.
- Return structured errors (`NO_DATA`, `INSUFFICIENT_DATA`, `MODEL_MISSING`, `SERVICE_DOWN`) and remove the default market and the silent `execSync` fallback.
- Retrain 7, 15 and 30 day models with walk-forward backtesting against the naive baselines, and add conformal intervals with measured coverage.
- Fix the target definition (no ffilled targets), and use NaN for missing arrivals and trade values.
- Where a market has too little data, offer an explicitly labelled crop-level (district) forecast. Never present it as market-specific.
