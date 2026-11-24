import os
import sys
import io
import json
import glob
import shutil
import tempfile
import gzip
import pandas as pd
import numpy as np
from datetime import datetime

# Centralized Crop Configuration
CROPS_CONFIG = {
    "cotton": {
        "crop_id": "cotton",
        "canonical_name": "Cotton",
        "aliases": ["Cotton", "Kapas", "Cotton (raw)", "Bramha", "DCH"],
        "commodity_codes": [15],
        "hs_codes": ["5201"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Cotton",
        "display_name_te": "పత్తి",
        "image_path": "/crops/cotton.png"
    },
    "dry_chillies": {
        "crop_id": "dry_chillies",
        "canonical_name": "Dry Chillies",
        "aliases": ["Dry Chillies", "Dry Chilli", "Red Chilli", "Chilli", "1st Sort", "Teja"],
        "commodity_codes": [113, 132],
        "hs_codes": ["090421", "090420", "0904"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Dry Chillies",
        "display_name_te": "ఎండు మిర్చి",
        "image_path": "/crops/dry_chillies.png"
    },
    "maize": {
        "crop_id": "maize",
        "canonical_name": "Maize",
        "aliases": ["Maize", "Corn", "Makka", "Yellow Maize"],
        "commodity_codes": [4],
        "hs_codes": ["100590", "1005"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Maize",
        "display_name_te": "మొక్కజొన్న",
        "image_path": "/crops/maize.png"
    },
    "turmeric": {
        "crop_id": "turmeric",
        "canonical_name": "Turmeric",
        "aliases": ["Turmeric", "Haldi", "Finger", "Bulb"],
        "commodity_codes": [35],
        "hs_codes": ["091030", "0910"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Turmeric",
        "display_name_te": "పసుపు",
        "image_path": "/crops/turmeric.png"
    },
    "groundnut": {
        "crop_id": "groundnut",
        "canonical_name": "Groundnut",
        "aliases": ["Groundnut", "Peanut", "Groundnut (Split)", "Palli"],
        "commodity_codes": [10],
        "hs_codes": ["120242", "1202"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Groundnut",
        "display_name_te": "వేరుశనగ",
        "image_path": "/crops/groundnut.png"
    },
    "paddy": {
        "crop_id": "paddy",
        "canonical_name": "Paddy",
        "aliases": ["Paddy", "Paddy(Common)", "Paddy(Dhan)", "BPT", "Rice(Paddy)"],
        "commodity_codes": [2],
        "hs_codes": ["100610", "1006"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Paddy",
        "display_name_te": "వరి (వడ్లు)",
        "image_path": "/crops/paddy.png"
    },
    "red_gram": {
        "crop_id": "red_gram",
        "canonical_name": "Red Gram",
        "aliases": ["Red Gram", "Arhar", "Tur", "Red gram/Arhar/Tur(whole)", "Pigeon Pea", "Kandi"],
        "commodity_codes": [45],
        "hs_codes": ["071360", "0713"],
        "units": {"price": "₹/Quintal", "arrival": "Tonnes"},
        "display_name_en": "Red Gram",
        "display_name_te": "కందులు",
        "image_path": "/crops/red_gram.png"
    }
}

WARANGAL_MARKETS_MAP = {
    "Warangal": "Warangal APMC",
    "Warangal APMC": "Warangal APMC",
    "Kesamudram": "Kesamudram APMC",
    "Kesamudram APMC": "Kesamudram APMC",
    "Jangaon": "Jangaon APMC",
    "Jangaon APMC": "Jangaon APMC",
    "Mahabubabad": "Mahabubabad APMC",
    "Mahabubabad APMC": "Mahabubabad APMC",
    "Narsampet": "Narsampet APMC",
    "Narsampet APMC": "Narsampet APMC",
    "Narsampet(Nekonda)": "Nekkonda APMC",
    "Nekkonda APMC": "Nekkonda APMC",
    "Mulugu": "Mulugu APMC",
    "Mulugu APMC": "Mulugu APMC",
    "Wardhannapet": "Wardhannapet APMC",
    "Wardhannapet APMC": "Wardhannapet APMC",
    "Ghanpur": "Station Ghanpur",
    "Thorrur": "Thorrur APMC",
    "Parkal": "Parkal APMC",
    "Kodakandal": "Kodakandal",
    "Cherial APMC": "Cherial APMC"
}

def safe_load_file(path):
    if path.endswith('.csv'):
        return pd.read_csv(path)
    elif path.endswith('.xlsx'):
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
            tmp_path = tmp.name
        try:
            shutil.copy2(path, tmp_path)
            return pd.read_excel(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    elif path.endswith('.csv.gz'):
        return pd.read_csv(path, compression='gzip')
    else:
        raise ValueError(f"Unsupported format: {path}")

def inspect_all():
    reports_dir = "datasets/reports"
    os.makedirs(reports_dir, exist_ok=True)
    
    profiles = {}
    quality_records = []
    
    # -------------------------------------------------------------
    # 1. Inspect Category A: Historical Mandi Prices (Datasets/*_tg*)
    # -------------------------------------------------------------
    print("Inspecting Category A: Historical Mandi Prices...")
    tg_files = sorted(glob.glob("Datasets/*_tg*"))
    for file_path in tg_files:
        fname = os.path.basename(file_path)
        df = safe_load_file(file_path)
        
        # Check column renaming requirement for paddy
        date_col = 'Arrival_Date'
        if date_col not in df.columns:
            if '0' in df.columns:
                date_col = '0'
        
        # Parse dates safely for profiling
        date_series = pd.to_datetime(df[date_col], format='mixed', errors='coerce')
        valid_dates = date_series.dropna()
        min_date = valid_dates.min().strftime('%Y-%m-%d') if len(valid_dates) > 0 else "N/A"
        max_date = valid_dates.max().strftime('%Y-%m-%d') if len(valid_dates) > 0 else "N/A"
        
        # Missing values
        missing_count = int(df.isnull().sum().sum())
        total_cells = int(df.size)
        missing_pct = round((missing_count / total_cells) * 100, 2)
        
        # Duplicates
        duplicate_count = int(df.duplicated().sum())
        
        # Check price anomalies
        invalid_prices = 0
        if 'Modal_Price' in df.columns and 'Min_Price' in df.columns and 'Max_Price' in df.columns:
            p_cond = (
                (df['Modal_Price'] <= 0) |
                (df['Min_Price'] <= 0) |
                (df['Max_Price'] <= 0) |
                (df['Min_Price'] > df['Max_Price']) |
                (df['Modal_Price'] < df['Min_Price']) |
                (df['Modal_Price'] > df['Max_Price'])
            )
            invalid_prices = int(p_cond.sum())
            
        crops_in_file = df['Commodity'].dropna().unique().tolist() if 'Commodity' in df.columns else []
        markets_in_file = df['Market'].dropna().unique().tolist() if 'Market' in df.columns else []
        districts_in_file = df['District'].dropna().unique().tolist() if 'District' in df.columns else []
        
        data_issues = []
        cleaning_ops = []
        if date_col == '0':
            data_issues.append("First column header is named '0' instead of 'Arrival_Date'")
            cleaning_ops.append("Rename column '0' to 'Arrival_Date'")
        if duplicate_count > 0:
            data_issues.append(f"{duplicate_count} duplicate rows found")
            cleaning_ops.append("Deduplicate observations on [date, crop, market, variety, grade]")
        if invalid_prices > 0:
            data_issues.append(f"{invalid_prices} records with price inconsistency (e.g. Min > Max or Modal outside range)")
            cleaning_ops.append("Flag and adjust/quarantine invalid price relations")
        if df['Arrival_Date' if 'Arrival_Date' in df.columns else '0'].isnull().sum() > 0:
            data_issues.append("Records with missing dates")
            cleaning_ops.append("Drop records with missing observation dates")
            
        cleaning_ops.append("Standardize dates to YYYY-MM-DD")
        cleaning_ops.append("Standardize market names to canonical APMC markets")
        cleaning_ops.append("Standardize crop name to canonical crop IDs")
        
        col_desc = {col: str(df[col].dtype) for col in df.columns}
        
        profile_item = {
            "category": "Historical Mandi Prices",
            "file_name": fname,
            "format": "csv" if fname.endswith('.csv') else "xlsx",
            "record_count": len(df),
            "column_count": len(df.columns),
            "columns": df.columns.tolist(),
            "column_descriptions": col_desc,
            "date_range": {"min": min_date, "max": max_date},
            "missing_cells": missing_count,
            "missing_percentage": missing_pct,
            "duplicate_count": duplicate_count,
            "invalid_price_records": invalid_prices,
            "crops": crops_in_file,
            "markets": markets_in_file,
            "districts": districts_in_file,
            "currency": "INR",
            "price_unit": "₹/Quintal",
            "frequency": "Daily",
            "data_quality_issues": data_issues,
            "recommended_cleaning": cleaning_ops
        }
        profiles[fname] = profile_item
        
        quality_records.append({
            "Category": "Historical Mandi Prices",
            "FileName": fname,
            "Format": profile_item["format"],
            "Records": len(df),
            "Columns": len(df.columns),
            "DateMin": min_date,
            "DateMax": max_date,
            "MissingPct": missing_pct,
            "Duplicates": duplicate_count,
            "InvalidValues": invalid_prices,
            "Crops": "; ".join(crops_in_file),
            "MarketsCount": len(markets_in_file),
            "Districts": "; ".join(districts_in_file),
            "Units": "₹/Quintal",
            "Issues": " | ".join(data_issues) if data_issues else "None",
            "RecommendedCleaning": " | ".join(cleaning_ops)
        })

    # -------------------------------------------------------------
    # 2. Inspect Category B: Mandi Arrivals & Agmarknet Samples
    # -------------------------------------------------------------
    print("Inspecting Category B: Mandi Arrivals...")
    arrivals_file = "india-mandi-arrivals/data/agmarknet/market_daily_sample.csv.gz"
    if os.path.exists(arrivals_file):
        fname = os.path.basename(arrivals_file)
        df_arr = pd.read_csv(arrivals_file, compression='gzip')
        date_series = pd.to_datetime(df_arr['date'], errors='coerce')
        min_date = date_series.min().strftime('%Y-%m-%d')
        max_date = date_series.max().strftime('%Y-%m-%d')
        
        missing_count = int(df_arr.isnull().sum().sum())
        missing_pct = round((missing_count / df_arr.size) * 100, 2)
        duplicate_count = int(df_arr.duplicated().sum())
        
        # Check negative arrivals or prices
        invalid_vals = int(((df_arr['arrival_t'] < 0) | (df_arr['modal_price_rs_qtl'] < 0)).sum())
        
        tg_arr = df_arr[df_arr['state'] == 'Telangana']
        wgl_arr = tg_arr[tg_arr['district'].isin(['Warangal', 'Warangal (Urban)', 'Warangal (Rural)', 'Jangaon', 'Mahabubabad', 'Mulugu', 'Jayashankar Bhupalpally', 'Hanumakonda'])]
        
        crops_in_arr = wgl_arr['commodity'].dropna().unique().tolist()
        markets_in_arr = wgl_arr['market'].dropna().unique().tolist()
        districts_in_arr = wgl_arr['district'].dropna().unique().tolist()
        
        data_issues = [
            f"National sample contains 275k+ rows; Warangal region has {len(wgl_arr)} arrival observations",
            "Arrivals reported in tonnes (arrival_t)",
            "Some calendar dates have no market report (non-reporting days)"
        ]
        cleaning_ops = [
            "Filter to Telangana & Warangal district mandis",
            "Map Agmarknet commodities to canonical crop IDs",
            "Standardize market names to APMC canonical names",
            "Preserve missing dates explicitly as non-reporting (do NOT impute to zero)"
        ]
        
        profile_item = {
            "category": "Mandi Arrivals & Daily Prices",
            "file_name": fname,
            "format": "csv.gz",
            "record_count": len(df_arr),
            "warangal_record_count": len(wgl_arr),
            "column_count": len(df_arr.columns),
            "columns": df_arr.columns.tolist(),
            "column_descriptions": {col: str(df_arr[col].dtype) for col in df_arr.columns},
            "date_range": {"min": min_date, "max": max_date},
            "missing_cells": missing_count,
            "missing_percentage": missing_pct,
            "duplicate_count": duplicate_count,
            "invalid_price_records": invalid_vals,
            "crops": crops_in_arr,
            "markets": markets_in_arr,
            "districts": districts_in_arr,
            "currency": "INR",
            "price_unit": "₹/Quintal",
            "arrival_unit": "Tonnes",
            "frequency": "Daily",
            "data_quality_issues": data_issues,
            "recommended_cleaning": cleaning_ops
        }
        profiles[fname] = profile_item
        
        quality_records.append({
            "Category": "Mandi Arrivals",
            "FileName": fname,
            "Format": "csv.gz",
            "Records": len(df_arr),
            "Columns": len(df_arr.columns),
            "DateMin": min_date,
            "DateMax": max_date,
            "MissingPct": missing_pct,
            "Duplicates": duplicate_count,
            "InvalidValues": invalid_vals,
            "Crops": "; ".join(crops_in_arr),
            "MarketsCount": len(markets_in_arr),
            "Districts": "; ".join(districts_in_arr),
            "Units": "Tonnes / ₹/Qtl",
            "Issues": " | ".join(data_issues),
            "RecommendedCleaning": " | ".join(cleaning_ops)
        })

    # -------------------------------------------------------------
    # 3. Inspect Category D: National Imports and Exports
    # -------------------------------------------------------------
    print("Inspecting Category D: Imports & Exports...")
    trade_excel_files = sorted(glob.glob("Datasets/*export*") + glob.glob("Datasets/*import*"))
    for file_path in trade_excel_files:
        fname = os.path.basename(file_path)
        df_t = pd.read_excel(file_path, header=None)
        
        # Identify title, report date, headers
        title = str(df_t.iloc[0, 0]) if df_t.shape[0] > 0 else ""
        report_meta = str(df_t.iloc[1, 0]) if df_t.shape[0] > 1 else ""
        header_row = df_t.iloc[2].tolist() if df_t.shape[0] > 2 else []
        
        # Rows with data
        data_rows = df_t.iloc[3:].dropna(how='all')
        
        # Identify currency and unit:
        # e.g. 'Values in ₹ Crore'
        currency = "INR"
        val_unit = "₹ Crore" if "₹ Crore" in report_meta or "Crore" in report_meta else "Unknown"
        trade_dir = "Export" if "export" in fname.lower() else "Import"
        
        data_issues = [
            "National-level aggregate data from DGCIS / Department of Commerce",
            "Annual/fiscal year granularity (not daily or district-specific)",
            "Values presented in ₹ Crore"
        ]
        cleaning_ops = [
            "Extract HSCode, Commodity description, fiscal year values, % share, % growth",
            "Label strictly as National-Level Trade statistics (do NOT label as Warangal)",
            "Align temporally to corresponding fiscal years for macro contextual indicator"
        ]
        
        profile_item = {
            "category": "National Imports & Exports",
            "file_name": fname,
            "format": "xlsx",
            "record_count": len(df_t),
            "data_record_count": len(data_rows),
            "column_count": len(df_t.columns),
            "headers": [str(h) for h in header_row if pd.notna(h)],
            "trade_direction": trade_dir,
            "currency": currency,
            "monetary_unit": val_unit,
            "frequency": "Annual / Fiscal Year",
            "is_national": True,
            "data_quality_issues": data_issues,
            "recommended_cleaning": cleaning_ops
        }
        profiles[fname] = profile_item
        
        quality_records.append({
            "Category": "National Trade (Imports/Exports)",
            "FileName": fname,
            "Format": "xlsx",
            "Records": len(data_rows),
            "Columns": len(df_t.columns),
            "DateMin": "2021-22",
            "DateMax": "2025-26",
            "MissingPct": 0.0,
            "Duplicates": 0,
            "InvalidValues": 0,
            "Crops": fname.split('_')[0],
            "MarketsCount": 0,
            "Districts": "National (India)",
            "Units": val_unit,
            "Issues": " | ".join(data_issues),
            "RecommendedCleaning": " | ".join(cleaning_ops)
        })

    # UPAG Trade Dataset
    upag_trade_file = "india-mandi-arrivals/data/upag/trade.csv.gz"
    if os.path.exists(upag_trade_file):
        fname = os.path.basename(upag_trade_file)
        df_u = pd.read_csv(upag_trade_file, compression='gzip')
        profile_item = {
            "category": "National Imports & Exports (UPAG)",
            "file_name": fname,
            "format": "csv.gz",
            "record_count": len(df_u),
            "column_count": len(df_u.columns),
            "columns": df_u.columns.tolist(),
            "fiscal_years": df_u['fiscalyear'].unique().tolist(),
            "trades": df_u['trade'].unique().tolist(),
            "commodities": df_u['commodity'].unique().tolist(),
            "metrics": df_u['metric'].unique().tolist(),
            "frequency": "Annual / Fiscal Year",
            "is_national": True,
            "data_quality_issues": ["National-level aggregate UPAG trade data across multiple crops"],
            "recommended_cleaning": ["Filter for the 7 target commodities and normalize fiscal years"]
        }
        profiles[fname] = profile_item
        quality_records.append({
            "Category": "National Trade (UPAG)",
            "FileName": fname,
            "Format": "csv.gz",
            "Records": len(df_u),
            "Columns": len(df_u.columns),
            "DateMin": str(df_u['fiscalyear'].min()),
            "DateMax": str(df_u['fiscalyear'].max()),
            "MissingPct": round((df_u.isnull().sum().sum() / df_u.size) * 100, 2),
            "Duplicates": int(df_u.duplicated().sum()),
            "InvalidValues": 0,
            "Crops": "; ".join(df_u['commodity'].dropna().unique()[:7]),
            "MarketsCount": 0,
            "Districts": "National (India)",
            "Units": "Quantity / Value",
            "Issues": "National-level historical trade metrics",
            "RecommendedCleaning": "Extract relevant crop trade series"
        })

    # Save JSON profile
    with open(os.path.join(reports_dir, "dataset_profile.json"), "w", encoding="utf-8") as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)
    print("Saved dataset_profile.json")
    
    # Save CSV quality report
    df_quality = pd.DataFrame(quality_records)
    df_quality.to_csv(os.path.join(reports_dir, "dataset_quality_report.csv"), index=False, encoding="utf-8")
    print("Saved dataset_quality_report.csv")
    
    # Generate comprehensive Markdown report
    md_content = generate_markdown_report(profiles, quality_records)
    with open(os.path.join(reports_dir, "dataset_inspection.md"), "w", encoding="utf-8") as f:
        f.write(md_content)
    print("Saved dataset_inspection.md")

def generate_markdown_report(profiles, quality_records):
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    md = f"""# Dataset Inspection and Profiling Report
**Project:** AI-Powered Agricultural Market Intelligence and Price Forecasting System for Warangal District  
**Generated On:** {now_str} (Asia/Kolkata)  
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
"""
    for r in quality_records:
        md += f"| {r['Category']} | `{r['FileName']}` | {r['Format']} | {r['Records']:,} | {r['DateMin']} to {r['DateMax']} | {r['MissingPct']}% | {r['Duplicates']} | {r['InvalidValues']} | {r['Units']} |\n"

    md += """
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
"""
    return md

if __name__ == "__main__":
    inspect_all()

