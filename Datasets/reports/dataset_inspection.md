# Dataset Inspection and Profiling Report
**Project:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Generated On:** 2026-11-04 09:38:43 (Asia/Kolkata)  
**Status:** Complete (Phase 1 Deliverable)

---

## 1. Executive Summary

This profiling report covers all four primary data categories specified in the project requirements:
1. **Category A: Historical Mandi Prices** (`Datasets/*_tg(2021-2026)*`)
2. **Category B: Mandi Arrivals** (`india-mandi-arrivals/data/agmarknet/market_daily_sample.csv.gz`)
3. **Category C: Daily Mandi Prices & Agmarknet Feeds**
4. **Category D: Agricultural Commodity Import & Export Statistics** (`Datasets/*export*`, `Datasets/*import*`, and UPAG `trade.csv.gz`)

---

## 2. Dataset Inventory and Summary Quality Table

| Category | File Name | Format | Records | Date Range | Missing % | Duplicates | Invalid Values | Units |
|---|---|---|---|---|---|---|---|---|
| Historical Mandi Prices | `cotton_tg(2021-2026).csv` | csv | 4,448 | 2021-01-11 to 2026-12-10 | 0.0% | 0 | 355 | ₹/Quintal |
| Historical Mandi Prices | `drychilli_tg(2021-2026).xlsx` | xlsx | 3,375 | 2022-01-03 to 2026-10-30 | 0.0% | 0 | 0 | ₹/Quintal |
| Historical Mandi Prices | `groundnut_tg(2021-2026).csv` | csv | 1,079 | 2021-06-12 to 2026-12-10 | 0.0% | 0 | 0 | ₹/Quintal |
| Historical Mandi Prices | `maize_tg(2021-2026).csv` | csv | 3,191 | 2021-02-11 to 2026-12-10 | 0.0% | 0 | 4 | ₹/Quintal |
| Historical Mandi Prices | `paddy_tg(2021-2026.csv` | csv | 406 | 2025-01-12 to 2026-12-10 | 0.0% | 0 | 0 | ₹/Quintal |
| Historical Mandi Prices | `redgram_tg(2021-2026).csv` | csv | 56 | 2026-01-27 to 2026-12-03 | 0.0% | 0 | 0 | ₹/Quintal |
| Historical Mandi Prices | `turmeric_tg(2021-2026).csv` | csv | 1,983 | 2022-01-06 to 2026-12-10 | 0.0% | 0 | 1 | ₹/Quintal |
| Mandi Arrivals | `market_daily_sample.csv.gz` | csv.gz | 275,423 | 2025-11-01 to 2026-10-21 | 0.0% | 0 | 0 | Tonnes / ₹/Qtl |
| National Trade (Imports/Exports) | `cotton_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `cotton_export(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `cotton_import(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `cotton_imports(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `drychilli_import(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `drychillies_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `drychillies_export(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `drychillies_import(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `groundnut_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `groundnut_export(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `groundnut_import(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `groundnut_import(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `maize_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `maize_export(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `maize_import(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `maize_imports(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `paddy_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `paddy_export(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `paddy_import(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `paddy_import(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `redgram_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `redgram_exports(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `redgram_imports(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `redgram_imports(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `turmeric_export(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `turmeric_export(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `turmeric_import(2025-2026).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (Imports/Exports) | `turmeric_imports(2022-23).xlsx` | xlsx | 2 | 2021-22 to 2025-26 | 0.0% | 0 | 0 | ₹ Crore |
| National Trade (UPAG) | `trade.csv.gz` | csv.gz | 467 | 2015 - 16 to 2026 - 27 | 2.69% | 4 | 0 | Quantity / Value |

---

## 3. Detailed Data Category Profiles

### Category A: Historical Mandi Prices (Warangal District)
The primary historical price files cover the 7 target crops in Warangal district from 2021 through 2026:
- **Cotton:** 4,448 records, 19 markets across undivided Warangal district.
- **Dry Chillies:** 3,375 records, covering major markets (Warangal APMC, Kesamudram, Thorrur, etc.).
- **Maize:** 3,191 records across 18 mandis.
- **Turmeric:** 1,983 records across Warangal mandis.
- **Groundnut:** 1,079 records across 8 mandis.
- **Paddy:** 406 records across 5 APMCs. Note: Header of column 0 was unlabelled ('0') instead of 'Arrival_Date'.
- **Red Gram:** 56 records in Warangal district.

**Column Structure:**
- `Arrival_Date`: Date of mandi arrival / price recording (DD-MM-YYYY or ISO datetime).
- `Commodity`: Commodity name reported by the market.
- `Commodity_Code`: Standardized Agmarknet commodity code.
- `District`: Administrative district (Warangal).
- `Market`: Mandi / Market yard name.
- `Grade`: Quality grade (e.g., FAQ - Fair Average Quality).
- `Variety`: Local botanical or commercial variety (e.g., Bramha, 1st Sort, Hybrid, BPT).
- `Min_Price`: Minimum transaction price (₹/Quintal).
- `Max_Price`: Maximum transaction price (₹/Quintal).
- `Modal_Price`: Modal price (most frequent transaction price, ₹/Quintal) - Primary Target.
- `State`: State of origin (Telangana).

### Category B: Mandi Arrivals
- Source: `india-mandi-arrivals/data/agmarknet/market_daily_sample.csv.gz` and live Agmarknet API via `indiagri/agmarknet.py`.
- Covers daily arrival volumes (`arrival_t` in tonnes) and corresponding modal prices.
- 545 daily arrival records specifically for Warangal region mandis in the sample period.
- **Important Data Rule:** Missing arrivals are strictly preserved as non-reporting days and are NEVER silently converted to zero.

### Category C: Daily Updated Mandi Prices
- Source: Agmarknet 2.0 public API and open government data APIs (Data.gov.in).
- Tracked fields: `observation_date`, `fetched_at`, `source_updated_at`.
- Distinction maintained between today's calendar observation and the latest reported market observation.

### Category D: National Imports and Exports
- Sources: 28 official DGCIS Ministry of Commerce trade tables and UPAG trade dataset.
- Granularity: Annual / Fiscal Year (e.g. 2021-22, 2022-23, 2024-25, 2025-26).
- Metric: Monetary value in ₹ Crore, % growth, % share of total national trade, and quantity.
- **Geographic Labeling Rule:** Strictly classified and labeled as **National-Level Information (All India)**, never presented as local Warangal district data.

---

## 4. Key Data Quality Issues & Cleaning Strategy

1. **Date Format Heterogeneity:** Mix of `DD-MM-YYYY` string formats and Excel datetime timestamps.  
   *Action:* Standardize to `YYYY-MM-DD` in Asia/Kolkata timezone.
2. **Column Naming Inconsistency:** `paddy_tg(2021-2026.csv` has column index 0 named `'0'`.  
   *Action:* Map column index 0 to `'Arrival_Date'`.
3. **Market Name Discrepancies:** Variations such as `"Warangal"` vs `"Warangal APMC"`, `"Kesamudram"` vs `"Kesamudram APMC"`.  
   *Action:* Centralized market dictionary mapping raw strings to canonical APMC identities.
4. **Price Relationship Validation:** Check that $Min\_Price \le Modal\_Price \le Max\_Price$ and all prices $> 0$.
5. **Rejection Audit Trail:** All malformed, non-positive, or unresolvable records will be logged in `datasets/reports/rejected_records.csv`.
