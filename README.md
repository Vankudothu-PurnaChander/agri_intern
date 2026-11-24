# AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District

An intelligent agricultural market information and price forecasting system developed to empower farmers in **Warangal district, Telangana, India** with transparent mandi rates, arrival analytics, and machine learning price forecasts.

---

## 🌾 Supported Crops & Geography

- **Target District:** Warangal, Telangana (including historically undivided sub-districts: Hanumakonda, Jangaon, Mahabubabad, Mulugu)
- **Reporting APMC Mandis:** Warangal APMC, Kesamudram APMC, Jangaon APMC, Mahabubabad APMC, Narsampet APMC, Nekkonda APMC, Mulugu APMC, Wardhannapet APMC, Thorrur APMC, Parkal APMC, Station Ghanpur, Cherial APMC.
- **7 Supported Commodities:**
  1. **Cotton** (పత్తి / Patti)
  2. **Dry Chillies** (ఎండు మిర్చి / Endu Mirchi)
  3. **Maize** (మొక్కజొన్న / Mokkajonna)
  4. **Turmeric** (పసుపు / Pasupu)
  5. **Groundnut** (వేరుశనగ / Verusanaga)
  6. **Paddy** (వరి / వడ్లు / Vari / Vadlu)
  7. **Red Gram** (కందులు / Kandulu)

---

## 🏛️ System Architecture

```text
React.js Frontend (Vite + Tailwind CSS + Recharts + Bilingual i18n)
                     │
                     ▼ (HTTP / REST APIs - Axios with In-Flight Deduplication)
       Node.js / Express.js Backend (Port 5000)
       ┌─────────────┴─────────────┐
       ▼                           ▼
MongoDB Atlas Cloud        Multi-Level Cache (Memory LRU / Redis)
(Covered Compound Indexes) ├── Dashboard Summary (30m TTL)
├── 14,056 Price Records   ├── Market Discovery (1h TTL)
├── 326 Arrival Records    └── Latest Prices (2m TTL)
├── 56 Trade Records                   │
└── 19 Correlation Records             ▼
                           Python ML Service (FastAPI / In-Process CLI)
                           ├── Feature Engineering (50+ Lags/Rolling)
                           ├── Baseline Models (Last, MA, SNaive)
                           ├── Random Forest & XGBoost Regressors
                           └── PyTorch CNN-BiLSTM-Attention Deep Learning
```

---

## 🚀 Key Features by Application Section

1. **Dashboard (`/`):**
   - Simple-language farmer introduction explaining how prices, arrivals, and AI forecasts assist harvesting decisions.
   - Summary statistics (7 supported crops, reporting mandis, latest observation date, 14,000+ verified observations).
   - 7 Crop Cards with real-time modal prices, 7-day movement percentage, and upward/downward/stable indicators.

2. **Current Market Prices (`/prices`):**
   - Dynamic market discovery populating only eligible reporting Warangal APMCs for the selected crop.
   - Distinct view modes:
     - **Latest Available Prices:** 30-Day continuous price history line chart (Min, Max, Modal prices) with gaps preserved, plus paginated observation records.
     - **Today's Prices Only:** Strictly filtered by Indian calendar date (`Asia/Kolkata`), cleanly displaying *"No price reported today."* if trading has not concluded.
   - Correctly labelled chart series and tooltips distinguishing Minimum, Modal, and Maximum prices.

3. **Market Arrivals (`/arrivals`):**
   - Daily date-wise crop arrival quantities in Tonnes sorted newest first.
   - 4 Summary Stat Cards: Latest Inflow, Period Cumulative Total, Daily Reported Average, and Active Reporting Days.
   - Time-series vertical bar chart strictly preserving daily calendar intervals and non-reporting gaps without false zero-imputation.
   - **Historical Price-Arrival Relationship & Farmer Guidance Card:** Farmer-friendly translation of Pearson & Spearman correlation dynamics, optimal lag response window, valid sample count, and optional technical lag breakdown (0, 1, 3, 7, 15 days).

4. **Mandi Comparison (`/comparison`):**
   - Inter-mandi modal price bar chart comparing the same crop across Warangal APMCs on the latest common observation date.
   - Dynamically calculated **Highest-Price Mandi Indicator** banner highlighting the top rate, mandi name, date, and margin.

5. **Future Price Trends (`/forecast`):**
   - Strictly 3 farmer inputs: Crop (7 crops), Market (dynamic Warangal APMCs), Duration (**strictly 7, 15, or 30 Days**).
   - Shaded uncertainty area graph on **future dates only** representing the 90% confidence price interval (`₹/Quintal`).
   - Top summary banner: *"Expected price range after X days: ₹X – ₹Y per quintal"*.
   - Evidence-based farmer reasoning explaining price trajectory, arrival momentum, and seasonal tendencies with zero technical formulas.
   - Honest recent arrival context with **zero fabricated future arrivals**.

6. **Bilingual Language Support:**
   - One-click toggle between **English** and **తెలుగు (Telugu)** across navigation, charts, labels, tooltips, and farmer guidance, stored in local storage.

---

## 📊 Machine Learning Model Evaluation (Chronological Test Split)

| Crop | Selected Best Algorithm | Test MAE (₹/Qtl) | Test RMSE (₹/Qtl) | MAPE (%) | Directional Accuracy (%) |
|---|---|---|---|---|---|
| **Cotton** | **Random Forest Regressor** | ₹582.40 | ₹733.60 | 7.40% | 37.65% |
| **Dry Chillies** | **XGBoost Regressor** | ₹2,495.67 | ₹3,130.10 | 13.56% | 64.71% |
| **Maize** | **Random Forest Regressor** | ₹263.74 | ₹374.27 | 11.57% | 53.74% |
| **Turmeric** | **Random Forest Regressor** | ₹1,476.72 | ₹1,916.41 | 12.11% | 46.05% |
| **Groundnut** | **Random Forest Regressor** | ₹1,504.54 | ₹1,996.28 | 21.61% | 56.02% |
| **Paddy** | **CNN-BiLSTM-Attention (PyTorch)** | ₹5.71 | ₹5.71 | 0.24% | Benchmark |
| **Red Gram** | **XGBoost Regressor** | ₹460.55 | ₹464.31 | 6.86% | 90.00% |

*No data leakage: Input features are strictly backward-looking. Future arrivals are never used as inputs.*

---

## 🛠️ Installation and Running

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB Atlas cluster URI configured in `backend/.env`

### 2. Backend Setup
```bash
cd backend
npm install
npm start
# Server listens on http://localhost:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

### 4. Automated Pipeline Scripts
- Bulk Database Ingestion: `python scripts/bulk_loader.py`
- Database Indexing: `node scripts/create_indexes.js`
- Statistical Correlation Ingestion: `node scripts/load_correlations.js`
- Automated Daily Sync: `python scripts/daily_collector.py`
- ML Training & Validation: `python -m ml_service.services.training_service`

---

## 📄 Project Documentation Links
- [Master Implementation & Repair Status](IMPLEMENTATION_STATUS.md)
- [Central Data Dictionary & Normalization](DATA_DICTIONARY.md)
- [Backend REST API Documentation](API_DOCUMENTATION.md)
- [Machine Learning Model Documentation](MODEL_DOCUMENTATION.md)
- [Performance & Bottleneck Audit](PERFORMANCE_AUDIT.md)
- [High-Performance Quantitative Benchmarks](PERFORMANCE_REPORT.md)
- [Database Ingestion Status](DATA_LOADING_STATUS.md)
