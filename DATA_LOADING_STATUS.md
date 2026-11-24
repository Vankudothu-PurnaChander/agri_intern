# Historical Data Loading & Synchronization Status

**Project:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Database Cluster:** MongoDB Atlas (`price.p6h9zun.mongodb.net`)  
**Pipeline Implementation:** `scripts/bulk_loader.py` (PyMongo + Idempotent Upsert + Batch Streaming)  
**Last Updated:** 2026-11-04  
**Status:** **100% COMPLETED & VERIFIED**

---

## 📊 Bulk Import Statistics Matrix

| Dataset Category | Source File | Total Records | Successfully Upserted | Skipped Duplicates | Rejected Records | Execution Time | Collection Name |
|---|---|---|---|---|---|---|---|
| **Historical Mandi Prices** | `datasets/processed/prices/cleaned_prices_all.csv` | 14,056 | **14,056** | 0 | 0 | 25.94s | `prices` |
| **Mandi Daily Arrivals** | `datasets/processed/arrivals/cleaned_arrivals_all.csv` | 326 | **326** | 0 | 0 | 1.31s | `arrivals` |
| **National Agricultural Trade** | `datasets/processed/trade/cleaned_trade_all.csv` | 56 | **56** | 0 | 0 | 0.20s | `trades` |
| **Total** | | **14,438** | **14,438** | **0** | **0** | **27.46s** | |

---

## ⚙️ Bulk Loading Design & Features

1. **Configurable Batching:** Tested and optimized at 2,500 operations per batch using MongoDB `bulk_write(ordered=False)` for maximum network pipelining and minimal roundtrips.
2. **Idempotence & Duplicate Prevention:** Every document is inserted using `UpdateOne(filter, {"$set": doc}, upsert=True)`. Re-running the pipeline at any point updates existing records in place without duplicating records or throwing duplicate key exceptions.
3. **Compound Key Integrity:**
   - **Prices:** `(observation_date, crop_id, canonical_market_name, variety, grade)`
   - **Arrivals:** `(observation_date, crop_id, canonical_market_name)`
   - **Trade:** `(fiscal_year, crop_id, trade_direction, hs_code)`
4. **Data Normalization & Validation:**
   - Date formats standardized to strict ISO-8601 `YYYY-MM-DD`.
   - Prices validated for non-negativity and boundary coherence (`min <= modal <= max`).
   - Arrival quantities standardized to Tonnes.
   - Crop names mapped to 7 core canonical IDs (`cotton`, `dry_chillies`, `maize`, `turmeric`, `groundnut`, `paddy`, `red_gram`).
   - Market names mapped to canonical Warangal APMC names.

