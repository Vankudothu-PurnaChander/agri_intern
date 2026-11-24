# Centralized Data Dictionary & Canonical Configuration

**Project:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Target District:** Warangal (including historically undivided sub-districts: Hanumakonda, Jangaon, Mahabubabad, Mulugu)  
**Target State:** Telangana, India  
**Timezone:** Asia/Kolkata  

---

## 1. Supported Agricultural Commodities (7 Crops)

| Crop ID | Canonical English Name | Telugu Name (తెలుగు) | Agmarknet Code | HS Code (Trade) | Price Unit | Arrival Unit | Standard Quality Grade | Common Varieties in Warangal |
|---|---|---|---|---|---|---|---|---|
| `cotton` | **Cotton** | పత్తి (Patti) | 15 | 5201 | ₹/Quintal | Tonnes | FAQ | Bramha, DCH-32, Bunny, MCU-5 |
| `dry_chillies` | **Dry Chillies** | ఎండు మిర్చి (Endu Mirchi) | 113, 132 | 090421 | ₹/Quintal | Tonnes | FAQ / 1st Sort | 1st Sort, Teja, Wonder Hot, Fatki, Guntur Hope |
| `maize` | **Maize** | మొక్కజొన్న (Mokkajonna) | 4 | 100590 | ₹/Quintal | Tonnes | FAQ | Hybrid, Yellow, Local |
| `turmeric` | **Turmeric** | పసుపు (Pasupu) | 35 | 091030 | ₹/Quintal | Tonnes | FAQ | Finger, Bulb, Nizamabad, Salem |
| `groundnut` | **Groundnut** | వేరుశనగ / పల్లీ (Verusanaga) | 10 | 120242 | ₹/Quintal | Tonnes | FAQ | Pods, Bold, TMV-2, JL-24 |
| `paddy` | **Paddy** | వరి / వడ్లు (Vari / Vadlu) | 2 | 100610 | ₹/Quintal | Tonnes | FAQ / Common | Paddy(Common), BPT-5204, Sona Masuri, MTU-1010 |
| `red_gram` | **Red Gram** | కందులు (Kandulu) | 45 | 071360 | ₹/Quintal | Tonnes | FAQ | White, Red, Asha, Maruti |

---

## 2. Warangal District Canonical Market Registry

All market observations from Warangal district (including historical undivided APMCs) are mapped to verified Agmarknet APMC identities:

| Raw Market Name in Datasets | Canonical Market Name | Current District | Historical District | Agmarknet Market ID |
|---|---|---|---|---|
| `Warangal`, `Warangal APMC` | **Warangal APMC** | Warangal | Warangal | 19 |
| `Kesamudram`, `Kesamudram APMC` | **Kesamudram APMC** | Mahabubabad | Warangal | 378 |
| `Jangaon`, `Jangaon APMC` | **Jangaon APMC** | Jangaon | Warangal | 901 |
| `Mahabubabad`, `Mahabubabad APMC` | **Mahabubabad APMC** | Mahabubabad | Warangal | 942 |
| `Narsampet`, `Narsampet APMC` | **Narsampet APMC** | Warangal | Warangal | 971 |
| `Narsampet(Nekonda)`, `Nekkonda APMC` | **Nekkonda APMC** | Warangal | Warangal | 2410 |
| `Mulugu`, `Mulugu APMC` | **Mulugu APMC** | Mulugu | Warangal | 954 |
| `Wardhannapet`, `Wardhannapet APMC` | **Wardhannapet APMC** | Warangal | Warangal | 1056 |
| `Thorrur` | **Thorrur APMC** | Mahabubabad | Warangal | 1036 |
| `Parkal` | **Parkal APMC** | Hanumakonda | Warangal | 986 |
| `Cherial APMC` | **Cherial APMC** | Siddipet / Warangal | Warangal | 856 |
| `Ghanpur` | **Station Ghanpur** | Jangaon | Warangal | N/A |
| `Kodakandal` | **Kodakandal** | Jangaon | Warangal | N/A |

---

## 3. Dataset Schemas

### A. Processed Price Observations (`datasets/processed/prices/`)
- `observation_date` (String, YYYY-MM-DD): The date on which the transaction occurred.
- `crop_id` (String): Normalized crop identifier (e.g. `cotton`, `dry_chillies`).
- `crop_name` (String): Canonical display name.
- `market_name` (String): Canonical APMC market name.
- `district` (String): District name (Warangal).
- `state` (String): Telangana.
- `variety` (String): Cleaned variety name.
- `grade` (String): Quality grade (FAQ, Medium, etc.).
- `min_price` (Float, ₹/Quintal): Minimum recorded price for the day.
- `max_price` (Float, ₹/Quintal): Maximum recorded price for the day.
- `modal_price` (Float, ₹/Quintal): Most frequent transaction price (Forecasting Target).
- `price_source` (String): Source file or API provenance.
- `fetched_at` (String, ISO timestamp): System acquisition timestamp.

### B. Processed Arrival Observations (`datasets/processed/arrivals/`)
- `observation_date` (String, YYYY-MM-DD): The reported market day.
- `crop_id` (String): Canonical crop ID.
- `market_name` (String): Canonical market name.
- `district` (String): District name.
- `arrival_quantity` (Float): Arrival volume in tonnes.
- `arrival_unit` (String): Standardized unit (`Tonnes`).
- `arrival_status` (String): Status enum (`REPORTED_POSITIVE`, `REPORTED_ZERO`, `NOT_REPORTED`).
- `source` (String): Agmarknet / Collector.

### C. Processed Trade Statistics (`datasets/processed/trade/`)
- `fiscal_year` (String, e.g., "2024 - 2025"): Financial year.
- `crop_id` (String): Target crop ID.
- `trade_direction` (String): `Export` or `Import`.
- `hs_code` (String): Harmonized System trade classification code.
- `monetary_value_crore_inr` (Float): Trade value in ₹ Crore.
- `pct_growth` (Float): Year-on-year percentage growth.
- `pct_share` (Float): Share of total national agricultural trade.
- `scope` (String): `NATIONAL_INDIA` (Strictly differentiated from Warangal local data).

### D. Integrated Price & Arrival Observations (`datasets/processed/integrated/`)
- Composite multi-index: `[observation_date, crop_id, market_name]`.
- Outer-join alignment ensuring price-only and arrival-only days are retained.
- Explicit indicator flags: `price_available` (bool), `arrival_available` (bool).
- Absence of arrival data is preserved as `NaN` (never filled as 0 without verification).

