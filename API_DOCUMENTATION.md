# Backend REST API Documentation

**Project:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Base URL:** `http://localhost:5000/api`  
**Protocol:** HTTP/1.1 REST  
**Data Format:** JSON (`application/json; charset=utf-8`)  
**Timezone:** `Asia/Kolkata` (IST)  
**Database:** MongoDB Atlas (Mongoose Connection Pool `min: 5, max: 25`)  
**Caching Engine:** Sub-millisecond In-Memory LRU + Optional Redis Layer with TTL management  

---

## 1. Standard Response Envelope & Conventions

All backend endpoints return responses conforming to a unified JSON envelope:

### Successful Single/Array Response
```json
{
  "success": true,
  "data": { ... } // or [ ... ]
}
```

### Successful Paginated Response
```json
{
  "success": true,
  "count": 50,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 14056,
    "totalPages": 282,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response Envelope
```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "error": "SPECIFIC_ERROR_CODE_OR_REASON",
  "statusCode": 400
}
```

### Common HTTP Status Codes
| Code | Meaning | Use Case |
|---|---|---|
| `200 OK` | Success | Request processed and response returned from Cache or DB. |
| `400 Bad Request` | Validation Failure | Invalid crop ID, non-numeric pagination params, unsupported horizon. |
| `404 Not Found` | Resource Absent | Crop or market not found in registered master lists. |
| `500 Internal Server Error` | Execution Exception | Unhandled runtime exception in service or controller. |
| `503 Service Unavailable` | Backend Dependency Down | MongoDB Atlas disconnected or ML Python environment missing. |

---

## 2. Health & Telemetry Endpoint

### `GET /api/health`
Inspects backend process health, MongoDB Atlas connection state, and cache hit/miss telemetry.

- **Query Parameters:** None
- **Response `200 OK`:**
```json
{
  "status": "healthy",
  "timestamp": "2026-11-04T06:15:20.123Z",
  "database": {
    "status": "connected",
    "host": "price-shard-00-01.p6h9zun.mongodb.net",
    "name": "warangal_agrimarket"
  },
  "cache": {
    "driver": "memory",
    "size": 42,
    "hits": 184,
    "misses": 31,
    "hitRate": "85.58%"
  },
  "uptimeSeconds": 1420
}
```

---

## 3. Dashboard Endpoints

### `GET /api/dashboard/summary`
Returns high-level statistics for Warangal district agricultural markets.
- **Cache TTL:** 1,800 seconds (30 mins)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "supportedCropsCount": 7,
    "reportingMandisCount": 13,
    "reportingMandisList": [
      "Warangal APMC",
      "Kesamudram APMC",
      "Jangaon APMC",
      "Narsampet APMC",
      "Parkal APMC",
      "Ghanpur (Station) APMC",
      "Wardhannapet APMC",
      "Mahabubabad APMC",
      "Dornakal APMC",
      "Thorur APMC",
      "Mulugu APMC",
      "Bhupalpally APMC",
      "Eturunagaram APMC"
    ],
    "latestObservationDate": "2026-10-30",
    "totalPriceObservations": 14056,
    "totalArrivalObservations": 326,
    "targetDistrict": "Warangal",
    "targetState": "Telangana"
  }
}
```

### `GET /api/dashboard/crop-overview`
Returns summary cards for all 7 supported crops with 7-day price percentage movements.
- **Cache TTL:** 900 seconds (15 mins)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "cropId": "cotton",
      "cropName": "Cotton",
      "displayNameEn": "Cotton",
      "displayNameTe": "పత్తి (Patti)",
      "imagePath": "/crops/cotton.png",
      "latestModalPrice": 6800,
      "priceUnit": "₹/Quintal",
      "sevenDayChangePct": 2.15,
      "trend": "UPWARD",
      "lastUpdatedDate": "2026-10-30"
    },
    {
      "cropId": "dry_chillies",
      "cropName": "Dry Chillies",
      "displayNameEn": "Dry Chillies",
      "displayNameTe": "ఎండు మిర్చి (Endu Mirchi)",
      "imagePath": "/crops/dry_chillies.png",
      "latestModalPrice": 18500,
      "priceUnit": "₹/Quintal",
      "sevenDayChangePct": -1.2,
      "trend": "DOWNWARD",
      "lastUpdatedDate": "2026-10-30"
    }
  ]
}
```

---

## 4. Current Market Prices Endpoints

### `GET /api/prices/latest`
Returns price records from MongoDB Atlas with compound index scanning, optional filtering, and server-side pagination.

- **Query Parameters:**
  - `cropId` (optional, string): Filter by crop ID (e.g. `cotton`, `maize`, `dry_chillies`).
  - `market` (optional, string): Filter by canonical APMC name (e.g. `Warangal APMC`).
  - `page` (optional, integer, default `1`): Page number.
  - `limit` (optional, integer, default `50`, max `500`): Results per page.
- **Cache TTL:** 120 seconds
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "observation_date": "2026-10-30",
      "crop_id": "cotton",
      "crop_name": "Cotton",
      "canonical_market_name": "Warangal APMC",
      "variety": "Bramha",
      "grade": "FAQ",
      "min_price": 6000,
      "modal_price": 6800,
      "max_price": 7000,
      "price_unit": "₹/Quintal"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 14056,
    "totalPages": 282,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### `GET /api/prices/today`
Returns prices reported strictly on today's calendar date in `Asia/Kolkata`.
- **Query Parameters:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "count": 0,
  "message": "No price reported today.",
  "data": []
}
```

### `GET /api/prices/history`
Returns daily historical prices for continuous line charts.
- **Query Parameters:**
  - `cropId` (required, string): e.g. `cotton`.
  - `market` (optional, string): Canonical market name. Defaults to `Warangal APMC`.
  - `days` (optional, integer, default `30`): Lookback window in calendar days.
- **Response `200 OK`:**
```json
{
  "success": true,
  "cropId": "cotton",
  "market": "Warangal APMC",
  "days": 30,
  "count": 22,
  "data": [
    {
      "date": "2026-10-01",
      "min_price": 6200,
      "modal_price": 6650,
      "max_price": 6900
    },
    {
      "date": "2026-10-03",
      "min_price": 6250,
      "modal_price": 6700,
      "max_price": 6950
    }
  ]
}
```

### `GET /api/prices/markets`
Dynamically discovers all eligible Warangal APMC markets reporting prices for a given crop.
- **Query Parameters:**
  - `cropId` (required, string): e.g. `cotton`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "cropId": "cotton",
  "data": [
    { "marketName": "Warangal APMC", "observationCount": 2480 },
    { "marketName": "Kesamudram APMC", "observationCount": 1820 },
    { "marketName": "Jangaon APMC", "observationCount": 1340 },
    { "marketName": "Narsampet APMC", "observationCount": 980 }
  ]
}
```

---

## 5. Market Arrivals Endpoints

### `GET /api/arrivals/latest`
Returns the latest reported arrival volume and 7-day/30-day moving averages.
- **Query Parameters:**
  - `cropId` (optional, string)
  - `market` (optional, string)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "cropId": "cotton",
    "market": "Warangal APMC",
    "latestQuantity": 867.35,
    "unit": "Tonnes",
    "avg7Days": 420.5,
    "avg30Days": 380.2,
    "observationDate": "2026-10-21"
  }
}
```

### `GET /api/arrivals/history`
Returns daily date-wise arrival quantities sorted newest first. Non-trading days are preserved without zero-imputation.
- **Query Parameters:**
  - `cropId` (required, string)
  - `market` (optional, string)
  - `days` (optional, integer, default `30`)
  - `page` (optional, integer, default `1`)
  - `limit` (optional, integer, default `50`)
- **Response `200 OK`:**
```json
{
  "success": true,
  "cropId": "cotton",
  "market": "Warangal APMC",
  "data": [
    {
      "date": "2026-10-21",
      "arrival_quantity": 867.35,
      "arrival_unit": "Tonnes",
      "crop_name": "Cotton",
      "canonical_market_name": "Warangal APMC"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 326,
    "totalPages": 7,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### `GET /api/arrivals/markets`
Returns all reporting APMC markets that have recorded arrival observations for the specified crop.
- **Query Parameters:**
  - `cropId` (required, string)
- **Response `200 OK`:**
```json
{
  "success": true,
  "cropId": "cotton",
  "data": [
    { "marketName": "Warangal APMC", "records": 326 }
  ]
}
```

---

## 6. Mandi Comparison Endpoints

### `GET /api/mandi-comparison/:cropId`
Performs an aggregation across all reporting Warangal APMCs on the latest common observation date. Evaluates the highest modal price mandi and price differentials.
- **URL Parameters:**
  - `cropId` (required, string): e.g. `cotton`, `maize`, `dry_chillies`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "cropId": "cotton",
    "cropName": "Cotton",
    "comparisonDate": "2026-10-30",
    "highestModalPrice": 7500,
    "highestMandis": ["Warangal APMC"],
    "mandis": [
      {
        "marketName": "Warangal APMC",
        "modalPrice": 7500,
        "minPrice": 6800,
        "maxPrice": 7800,
        "variety": "Bramha",
        "priceUnit": "₹/Quintal"
      },
      {
        "marketName": "Kesamudram APMC",
        "modalPrice": 7250,
        "minPrice": 6600,
        "maxPrice": 7400,
        "variety": "FAQ",
        "priceUnit": "₹/Quintal"
      }
    ]
  }
}
```

---

## 7. Statistical Price-Arrival Relationship Endpoints

### `GET /api/analysis/price-arrival/:cropId`
Returns paired price-arrival correlation dynamics, optimal lag response, sample size, and objective farmer-friendly interpretation.
- **URL Parameters:**
  - `cropId` (required, string): e.g. `cotton`, `maize`, `dry_chillies`.
- **Query Parameters:**
  - `market` (optional, string): Canonical APMC name (e.g. `Warangal APMC`). Defaults to district aggregate.
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "crop_id": "cotton",
    "crop_name": "Cotton",
    "market_name": "Warangal APMC",
    "analysis_date": "2026-11-04",
    "sample_count": 20,
    "pearson": {
      "correlation": -0.4288,
      "p_value": 0.0592,
      "is_significant": false
    },
    "spearman": {
      "correlation": -0.1734,
      "p_value": 0.46462,
      "is_significant": false
    },
    "selected_lag": 1,
    "interpretation": "Over 20 valid observations, arrivals and modal prices show a moderate negative (higher arrivals tend to correspond with lower prices) at a 1-day lag. This relationship is statistically significant (p < 0.05). Note: Correlation indicates historical association, not real-world causation."
  }
}
```

### `GET /api/analysis/lag-analysis/:cropId`
Returns granular multi-lag cross-correlations across 0, 1, 3, 7, and 15 days.
- **URL Parameters:** `cropId`
- **Query Parameters:** `market`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "cropId": "cotton",
    "laggedCorrelations": {
      "lag_0_days": { "lag_days": 0, "correlation": -0.4288, "p_value": 0.0592, "sample_count": 20, "is_significant": false },
      "lag_1_days": { "lag_days": 1, "correlation": -0.4445, "p_value": 0.04955, "sample_count": 20, "is_significant": true },
      "lag_3_days": { "lag_days": 3, "correlation": -0.4121, "p_value": 0.0711, "sample_count": 20, "is_significant": false },
      "lag_7_days": { "lag_days": 7, "correlation": -0.3892, "p_value": 0.0924, "sample_count": 19, "is_significant": false },
      "lag_15_days": { "lag_days": 15, "correlation": -0.3654, "p_value": 0.1142, "sample_count": 19, "is_significant": false }
    },
    "selectedLag": 1,
    "interpretation": "Over 20 valid observations..."
  }
}
```

---

## 8. Machine Learning Price Forecasting Endpoints

### `GET /api/forecast/:cropId`
Fetches multi-horizon price predictions, 90% confidence spread intervals, and evidence-based farmer guidance.
- **URL Parameters:**
  - `cropId` (required, string)
- **Query Parameters:**
  - `market` (optional, string, default `'Warangal APMC'`)
  - `horizon` (optional, integer, strictly `7`, `15`, or `30`, default `15`)
- **Cache TTL:** 600 seconds (10 mins)
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "crop_id": "cotton",
    "crop_name": "Cotton",
    "market_name": "Warangal APMC",
    "status": "SUCCESS",
    "forecast_origin_date": "2026-10-30",
    "latest_actual_price": 6800,
    "forecast_final_price": 7120,
    "lower_bound_final": 6850,
    "upper_bound_final": 7390,
    "expected_range_summary": "Expected price range after 15 days: ₹6,850 – ₹7,390 per quintal",
    "forecast_horizon_days": 15,
    "trend_direction": "INCREASING",
    "trend_label": "Increasing Trend",
    "farmer_explanation": "Price is expected to increase by approximately 4.71% over the next 15 days.",
    "farmer_guidance": "Market indicators suggest strengthening demand or tightening supply. Consider monitoring upcoming mandi arrivals before selling.",
    "future_points": [
      {
        "date": "2026-10-31",
        "lower_bound": 6780,
        "predicted_price": 6820,
        "upper_bound": 6860
      },
      {
        "date": "2026-11-14",
        "lower_bound": 6850,
        "predicted_price": 7120,
        "upper_bound": 7390
      }
    ],
    "recent_arrival_context": {
      "summary": "Arrival volumes over the past week have decreased slightly.",
      "latest_arrival_tonnes": 867.35
    }
  }
}
```

### Empty / Insufficient Data Response `200 OK`
```json
{
  "success": true,
  "data": {
    "status": "INSUFFICIENT_DATA",
    "crop_id": "turmeric",
    "market_name": "Dornakal APMC",
    "message": "Fewer than 15 historical trading records exist for this combination."
  }
}
```

---

## 8. Data Ingestion & Collector Triggers

### `POST /api/data/collect`
Triggers an asynchronous background collection task using `scripts/daily_collector.py` to poll Data.gov.in and Agmarknet for today's market rates.
- **Request Body (optional):**
```json
{
  "force": false
}
```
- **Response `202 Accepted`:**
```json
{
  "success": true,
  "message": "Daily collection initiated in background.",
  "taskId": "collector_1762237890"
}
```
- **Audit Logging:** Logs results to MongoDB `collectionlogs` collection and writes `datasets/reports/daily_collection_log.json`.

---

## 9. Performance & Optimization Highlights

1. **Connection Pooling:** Backend connects to MongoDB Atlas with `minPoolSize: 5` and `maxPoolSize: 25`, preventing TCP reconnect storms.
2. **Compound Indexing:** All queries utilize covered indexes on `{ crop_id: 1, canonical_market_name: 1, observation_date: -1 }`.
3. **Multi-Level Caching:** In-memory LRU cache serves hot dashboard summaries and recent prices in `< 1ms` (zero database roundtrip).
4. **Client Request Deduplication:** React Axios service transparently deduplicates concurrent requests for the same crop and market.
5. **Server-Side Pagination:** Tables load records in chunks of 50 items rather than buffering thousands of rows in DOM memory.
