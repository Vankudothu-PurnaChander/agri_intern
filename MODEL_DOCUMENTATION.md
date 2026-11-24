# Machine Learning Model Documentation

**Project:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Target District:** Warangal, Telangana, India  
**Forecast Horizons:** 7 Days, 15 Days, 30 Days (Farmer-facing multi-step horizons)  
**Target Metric:** Modal Mandi Price (₹/Quintal)  
**Last Evaluated:** 2026-11-04  

---

## 1. Feature Engineering & Leakage Prevention

All model features are engineered strictly from historical observations up to the forecast origin date $t$. No future prices, future arrival values, or future rolling aggregations are used.

### Feature Categories:
1. **Price Lag Features:** $P_{t-1}, P_{t-2}, P_{t-3}, P_{t-7}, P_{t-14}, P_{t-15}, P_{t-30}$
2. **Price Rolling Statistics:**
   - 7-day, 15-day, 30-day backward-looking moving averages
   - 7-day, 15-day rolling medians
   - 7-day, 15-day rolling standard deviations (volatility indicators)
   - 1-day, 7-day, 15-day price momentum and percentage changes
   - Lagged price spread: $(Max_{t-1} - Min_{t-1}) / Modal_{t-1}$
3. **Mandi Arrival Features:**
   - Lagged arrivals: $A_{t-1}, A_{t-3}, A_{t-7}, A_{t-15}$
   - 3-day, 7-day, 15-day, 30-day rolling arrival averages
   - 7-day arrival rate of change
   - Arrival missingness ratio over 15-day window
4. **Temporal & Calendar Features:**
   - `day_of_week`, `day_of_month`, `month`, `year`
   - Agricultural season: Kharif (1), Rabi (2), Zaid (3)
   - Cyclical harmonic encodings: $\sin / \cos$ of month and day of month
   - Weekend indicators
5. **Macro National Trade Contextual Indicators:**
   - Lagged fiscal year completed national exports (₹ Crore)
   - Lagged fiscal year completed national imports (₹ Crore)
   - Lagged fiscal year national agricultural trade balance (₹ Crore)

---

## 2. Models Implemented & Evaluated

### A. Baselines (Benchmarks)
- **Last Observed Price Baseline:** $\hat{y}_{t+h} = y_{t-1}$
- **Moving Average Baseline (7-Day):** $\hat{y}_{t+h} = \frac{1}{7}\sum_{k=1}^7 y_{t-k}$
- **Seasonal Naive Baseline:** $\hat{y}_{t+h} = y_{t-30}$ or $y_{t-365}$

### B. Traditional Machine Learning Models
- **Random Forest Regressor:**
  - Ensemble of decorrelated decision trees with bagging.
  - Hyperparameter grid tuned across `n_estimators` (100–200), `max_depth` (8–16), and `min_samples_split` (2–5).
  - Prediction interval estimation via tree ensemble variance.
- **XGBoost Regressor:**
  - Gradient boosted decision trees with early stopping on validation loss.
  - Tuned with learning rate (0.02–0.05), subsample (0.8–0.9), and max depth (4–6).
  - Prediction intervals based on residual distribution quantiles.

### C. Deep Learning: CNN-BiLSTM-Attention Architecture
- **Framework:** PyTorch
- **Architecture Pipeline:**
  1. **Input Sequence:** 30-day historical window across all standardized engineered features.
  2. **1D-CNN Layer:** Kernel size 3, 64 filters, batch normalization, ReLU activation. Extracts local temporal patterns across multi-day transaction windows.
  3. **Bidirectional LSTM:** 2 stacked layers, 64 hidden units per direction (128 total). Models long-term sequential dependencies.
  4. **Temporal Attention Mechanism:** Scaled dot-product self-attention scoring which historical time steps within the 30-day window possess the highest predictive relevance.
  5. **Dense Forecasting Head:** Multi-layer perceptron (128 -> 64 -> 32 -> 1) with dropout regularization (0.2).
  6. **Optimization:** Adam optimizer with Smooth L1 Loss and learning rate scheduling on validation plateau.

---

## 3. Chronological Evaluation & Model Comparison Table

Evaluated on untouched, chronologically held-out test splits (70% Train, 15% Validation, 15% Test):

| Crop | Selected Best Algorithm | Test MAE (₹/Qtl) | Test RMSE (₹/Qtl) | MAPE (%) | $R^2$ | Directional Accuracy (%) | Primary Predictive Features |
|---|---|---|---|---|---|---|---|
| **Cotton** | **Random Forest Regressor** | ₹582.40 | ₹733.60 | 7.40% | 0.2376 | 37.65% | `price_lag_1`, `price_rolling_mean_7`, `trade_export_lag_crore` |
| **Dry Chillies** | **XGBoost Regressor** | ₹2,495.67 | ₹3,130.10 | 13.56% | 0.2919 | 64.71% | `price_lag_1`, `price_rolling_mean_15`, `month`, `arrival_rolling_mean_7` |
| **Maize** | **Random Forest Regressor** | ₹263.74 | ₹374.27 | 11.57% | 0.2553 | 53.74% | `price_lag_1`, `price_lag_7`, `price_rolling_median_7`, `day_of_month` |
| **Turmeric** | **Random Forest Regressor** | ₹1,476.72 | ₹1,916.41 | 12.11% | 0.4740 | 46.05% | `price_lag_1`, `price_rolling_mean_7`, `season`, `cos_month` |
| **Groundnut** | **Random Forest Regressor** | ₹1,504.54 | ₹1,996.28 | 21.61% | -0.0876 | 56.02% | `price_lag_1`, `price_lag_15`, `price_rolling_mean_30` |
| **Paddy** | **CNN-BiLSTM-Attention** | ₹5.71 | ₹5.71 | 0.24% | 0.0000 | 0.00% | `price_lag_1`, `temporal_attention_weights`, `price_rolling_mean_7` |
| **Red Gram** | **XGBoost Regressor** | ₹460.55 | ₹464.31 | 6.86% | -7.0942 | 90.00% | `price_lag_1`, `price_lag_3`, `price_rolling_mean_7` |

---

## 4. Operational Model Deployment & Uncertainty Guidelines

1. **Point Estimates vs Bounds:** Displayed predicted prices are point estimates bounded by **90% Confidence Intervals** ($\hat{y} \pm z \cdot \sigma_h$).
2. **Horizon Uncertainty:** Uncertainty intervals automatically widen as the forecast horizon expands across 7, 15, and 30 days.
3. **Farmer Guidance Ethics:** The system explicitly notifies farmers that predictions are probabilistic intelligence to assist decision-making, not guaranteed future transaction prices.

