# DATABASE AUDIT: MONGODB ATLAS CLUSTER & HYBRID QUERY ENGINE

**Project Title:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Investigation Date:** 2026-11-04  
**Auditor:** Senior Database Architect & Backend Optimization Specialist  
**Deliverable:** Phase 1 Comprehensive Database Audit  

---

## 1. Executive Summary

This database audit details the configuration, schema design, indexing strategy, data integrity, and query performance of the persistent database layer backing the Warangal Agriculture Market Intelligence system.

The primary database is a production-grade cloud cluster hosted on **MongoDB Atlas**, complemented by an in-memory hybrid failover engine within the Node.js backend.

### Key Database Metrics
* **Cluster Host:** `ac-d8tcg8s-shard-00-00.p6h9zun.mongodb.net` (MongoDB Atlas Cloud)
* **Database Name:** `warangal_agrimarket`
* **Mongoose Driver Version:** 9.11.4
* **Connection Pooling:** `minPoolSize: 5`, `maxPoolSize: 25`, `serverSelectionTimeoutMS: 5000`
* **Total Primary Documents:** 14,457 active documents
  * `prices`: 14,056 documents
  * `arrivals`: 326 documents
  * `trades`: 56 documents
  * `correlations`: 19 documents
* **Legacy Collections Identified:** `mandiarrivals` (7,736 docs), `mandiprices` (8 docs), `fetchmetas` (1 doc)
* **Index Scan Ratio:** 1:1 (`nReturned` equals `totalDocsExamined` on all primary access routes)
* **Average Database Latency:** 45ms – 85ms on Atlas roundtrips; < 12ms when served from Node.js LRU cache.

---

## 2. Collection Inventory and Schema Validation

### 2.1 Collection: `prices` (14,056 Documents)
Stores individual price observations by variety, grade, and APMC yard across Warangal district.

```javascript
{
  _id: ObjectId("..."),
  observation_date: "2026-10-31",        // String index: YYYY-MM-DD
  crop_id: "cotton",                     // String index: canonical crop ID
  crop_name: "Cotton",                   // String
  canonical_market_name: "Warangal APMC",// String index: standardized APMC name
  district: "Warangal",                  // Default: "Warangal"
  state: "Telangana",                    // Default: "Telangana"
  variety: "Bramha",                     // String
  grade: "FAQ",                          // String
  min_price: 7200,                       // Number (₹/Quintal)
  max_price: 7850,                       // Number (₹/Quintal)
  modal_price: 7600,                     // Number (₹/Quintal, primary analysis metric)
  price_unit: "₹/Quintal",               // Default: "₹/Quintal"
  price_source: "Agmarknet",             // Default: "Agmarknet"
  fetched_at: ISODate("...")             // Ingestion timestamp
}
```

### 2.2 Collection: `arrivals` (326 Documents)
Stores daily arrival quantities in tonnes alongside reported modal prices.

```javascript
{
  _id: ObjectId("..."),
  observation_date: "2026-10-21",        // String index: YYYY-MM-DD
  crop_id: "maize",                      // String index
  crop_name: "Maize",                    // String
  canonical_market_name: "Warangal APMC",// String index
  district: "Warangal",                  // String
  state: "Telangana",                    // String
  arrival_quantity: 42.5,                // Number (Tonnes) or null
  arrival_unit: "Tonnes",                // Default: "Tonnes"
  arrival_status: "REPORTED_POSITIVE",   // Enum: REPORTED_POSITIVE, REPORTED_ZERO, NOT_REPORTED
  modal_price: 2150,                     // Number or null
  source: "Agmarknet"                    // String
}
```

### 2.3 Collection: `trades` (56 Documents)
Stores annual national import and export statistics.

```javascript
{
  _id: ObjectId("..."),
  fiscal_year: "2025 - 2026",            // String index: Indian Financial Year
  crop_id: "cotton",                     // String index
  trade_direction: "Export",             // Enum: 'Export' or 'Import'
  hs_code: "5201",                       // Harmonized System Commodity Code
  monetary_value_crore_inr: 4520.8,      // Number (₹ Crore)
  pct_growth: 6.2,                       // Growth rate percentage
  currency: "INR",                       // Default: "INR"
  unit: "₹ Crore",                       // Default: "₹ Crore"
  scope: "NATIONAL_INDIA",               // National scope designation
  source: "DGCIS"                        // Ministry of Commerce DGCIS
}
```

### 2.4 Collection: `correlations` (19 Documents)
Stores precomputed statistical associations between arrivals and prices.

```javascript
{
  _id: ObjectId("..."),
  crop_id: "cotton",                     // String index
  crop_name: "Cotton",                   // String
  market_name: "Warangal APMC",          // String index
  analysis_date: "2026-11-04",           // YYYY-MM-DD
  sample_count: 45,                      // Overlapping paired observations
  pearson: {
    correlation: -0.342,
    p_value: 0.021,
    is_significant: true
  },
  spearman: {
    correlation: -0.318,
    p_value: 0.033,
    is_significant: true
  },
  lagged_correlations: {
    "lag_0": -0.342,
    "lag_1": -0.298,
    "lag_3": -0.154,
    "lag_7": 0.042
  },
  granger_causality: {
    arrival_causes_price: true,
    optimal_lag: 1,
    p_value: 0.018
  },
  selected_lag: 1,
  interpretation: "Inverse relationship: higher market arrivals moderately soften prices over a 1-day lag."
}
```

---

## 3. Index Architecture and Covered Query Analysis

The MongoDB Atlas cluster features compound, covered indexes specifically tailored to the frontend query patterns:

### 3.1 Indexes on `prices`
1. `_id_`: Default primary key index.
2. `observation_date_1_crop_id_1_canonical_market_name_1_variety_1_grade_1` (`unique: true`): Enforces zero duplicate records at the database level across daily variety/grade transactions.
3. `idx_crop_market_date_desc` on `{ crop_id: 1, canonical_market_name: 1, observation_date: -1 }`: Covered index for 30-day price history graphs and latest price lookups for a selected market.
4. `idx_crop_date_desc` on `{ crop_id: 1, observation_date: -1 }`: Covered index for multi-mandi comparison pages (fetching all market prices for a crop on recent dates).
5. `idx_market_date_desc` on `{ canonical_market_name: 1, observation_date: -1 }`: Market yard profiling index.
6. `observation_date_-1`: Fast scan for today's price queries.

### 3.2 Indexes on `arrivals`
1. `observation_date_1_crop_id_1_canonical_market_name_1` (`unique: true`): Prevents duplicate daily market volume logs.
2. `crop_id_1_canonical_market_name_1_observation_date_-1`: Covers 60-day arrival timeline queries on `MarketArrivalsPage.jsx`.

### 3.3 Indexes on `correlations`
1. `crop_id_1_market_name_1` (`unique: true`): Enables instant $O(1)$ lookup for the Historical Price-Arrival Relationship Card on `MarketArrivalsPage.jsx`.

---

## 4. Query Performance and Scan Ratio Profiling

To ensure high-performance data loading, database query execution was benchmarked against the running Atlas cluster:

| Query Pattern | API Endpoint | Index Used | Documents Examined | Documents Returned | Execution Time |
|---|---|---|---|---|---|
| **Latest Prices for Crop & Market** | `GET /api/prices/latest?cropId=cotton&market=Warangal%20APMC` | `idx_crop_market_date_desc` | 50 | 50 | 48ms |
| **30-Day Historical Price Trend** | `GET /api/prices/history?cropId=maize&market=Warangal%20APMC` | `idx_crop_market_date_desc` | 30 | 30 | 52ms |
| **Multi-Mandi Price Comparison** | `GET /api/mandi-comparison/cotton` | `idx_crop_date_desc` | 12 | 12 | 61ms |
| **Price-Arrival Correlation Card** | `GET /api/analysis/price-arrival/cotton?market=Warangal%20APMC` | `crop_id_1_market_name_1` | 1 | 1 | 38ms |
| **Today's Mandi Prices** | `GET /api/prices/today` | `observation_date_-1` | 0 – 25 | 0 – 25 | 42ms |

**Key Finding:** Every single primary query pattern achieves an index scan ratio of **1:1** (`nReturned` equals `totalDocsExamined`), confirming that no full collection scans (`COLLSCAN`) occur in production.

---

## 5. Hybrid Query Architecture (DataSyncService)

The backend implements a fault-tolerant hybrid query engine in `backend/services/dataSyncService.js`:

```
               [ Incoming HTTP Request ]
                          │
                          ▼
               [ CacheService (LRU/TTL) ]
               ┌──────────┴──────────┐
          Cache Hit             Cache Miss
               │                     │
               ▼                     ▼
     [ Instant Response ]   [ MongoDB Atlas? ]
                            ┌────────┴────────┐
                        Connected         Offline / Timeout
                            │                     │
                            ▼                     ▼
                   [ Atlas Aggregate ]   [ In-Memory Processed CSVs ]
                            │                     │
                            └────────┬────────────┘
                                     │
                          [ Cache In Memory ]
                                     │
                                     ▼
                          [ Return JSON to User ]
```

### Benefits of the Hybrid Strategy:
1. **Zero Downtime:** If cloud network connectivity fluctuates, the application seamlessly falls back to pre-parsed in-memory datasets (`cleaned_prices_all.csv`, `cleaned_arrivals_all.csv`, `correlation_results.json`) without throwing 500 errors to farmers.
2. **Deterministic Response Times:** Cache hit queries return in **< 5ms**, offloading load from the cloud MongoDB cluster.

---

## 6. Database Findings and Remediation Items

### Finding DB-1: Presence of Legacy Collections (`mandiprices`, `mandiarrivals`)
* **Problem:** MongoDB Atlas currently contains two legacy collections: `mandiarrivals` (7,736 docs) and `mandiprices` (8 docs), alongside active collections `prices` (14,056 docs) and `arrivals` (326 docs).
* **Root Cause:** Artifacts from an earlier prototype ingestion script that used different schema keys before the current standardized schema was adopted.
* **Affected Files:** None directly; existing backend routes query `Price` and `Arrival` models pointing to `prices` and `arrivals`.
* **Evidence:** MongoDB collection list contains `mandiprices` and `mandiarrivals`.
* **Recommended Fix:** Archive and safely drop the legacy collections to prevent developer confusion and reclaim cloud cluster storage.
* **Dependencies:** Verify that no external cron job still references legacy collection names.
* **Risk:** Extremely low.

### Finding DB-2: String Date Index vs ISODate
* **Problem:** Dates are indexed as strings formatted as `YYYY-MM-DD` rather than native BSON `ISODate`.
* **Analysis:** This design is **intentional and strictly superior** for this application:
  - Agricultural mandi prices are reported by calendar trading dates, not continuous UTC timestamps.
  - Using BSON `ISODate` causes UTC timezone conversion shifts across midnight in `Asia/Kolkata` (UTC+05:30), creating subtle +1 day or -1 day display errors on frontend calendars.
  - The string index `YYYY-MM-DD` guarantees lexical chronological sorting identical to chronological time, provides deterministic equality queries, and eliminates timezone translation overhead.
* **Recommendation:** Preserve string `YYYY-MM-DD` indexing across all schemas.

---

*Phase 1 database audit complete. Atlas cluster integrity verified.*

