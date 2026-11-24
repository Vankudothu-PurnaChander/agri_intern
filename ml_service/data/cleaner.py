"""Data Preprocessing, Cleaning, and Standardization Pipeline for Warangal Market Intelligence.
Standardizes dates, crops, markets, prices, arrivals, and national trade statistics.
"""
import os
import json
import glob
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

from ml_service.config import (
    CROPS, WARANGAL_MARKETS, TARGET_DISTRICT, TARGET_STATE,
    resolve_crop_id, resolve_market, DATASETS_RAW, DATASETS_PROCESSED, DATASETS_REPORTS,
    PROJECT_ROOT
)
from ml_service.data.loader import safe_read_file
from ml_service.data.validator import DataValidator

def parse_date_smart(val):
    """Accurately parses various date representations (ISO, DD-MM-YYYY, Excel Timestamps)."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()
    if '-' in s and len(s.split('-')[0]) == 4:
        parsed = pd.to_datetime(s, format='%Y-%m-%d', errors='coerce')
    elif '/' in s and len(s.split('/')[0]) == 4:
        parsed = pd.to_datetime(s, errors='coerce')
    else:
        parsed = pd.to_datetime(s, dayfirst=True, errors='coerce')
    return parsed.strftime('%Y-%m-%d') if pd.notnull(parsed) else None

class DataCleaner:
    def __init__(self):
        self.validator = DataValidator()
        self.cleaning_stats = {
            "prices": {"total_raw": 0, "cleaned": 0, "rejected": 0, "duplicates_removed": 0},
            "arrivals": {"total_raw": 0, "cleaned": 0, "rejected": 0},
            "trade": {"total_raw": 0, "cleaned": 0, "rejected": 0}
        }
        
    def clean_historical_prices(self):
        """Processes and standardizes all Datasets/*_tg* historical price files."""
        print("Cleaning Historical Mandi Prices...")
        raw_files = sorted(glob.glob(str(DATASETS_RAW / "*_tg*")))
        all_cleaned_records = []
        
        for file_path in raw_files:
            fname = os.path.basename(file_path)
            raw_df = safe_read_file(file_path)
            self.cleaning_stats["prices"]["total_raw"] += len(raw_df)
            
            # 1. Normalize column names (handle paddy column 0)
            df = raw_df.copy()
            if "0" in df.columns and "Arrival_Date" not in df.columns:
                df = df.rename(columns={"0": "Arrival_Date"})
                
            # Determine crop from filename or content
            base_crop_str = fname.split("_")[0].replace("tg", "")
            file_crop_id = resolve_crop_id(base_crop_str)
            
            for idx, raw_row in df.iterrows():
                row_dict = raw_row.to_dict()
                
                # Date Standardization
                raw_date = row_dict.get("Arrival_Date")
                obs_date = parse_date_smart(raw_date)
                if not obs_date:
                    self.validator.log_rejection(row_dict, "Unparseable observation date", "Prices")
                    self.cleaning_stats["prices"]["rejected"] += 1
                    continue
                    
                # Crop Standardization
                crop_raw = row_dict.get("Commodity", base_crop_str)
                crop_id = resolve_crop_id(crop_raw) or file_crop_id
                if not crop_id:
                    self.validator.log_rejection(row_dict, f"Unknown commodity: {crop_raw}", "Prices")
                    self.cleaning_stats["prices"]["rejected"] += 1
                    continue
                    
                crop_meta = CROPS[crop_id]
                
                # Market Standardization
                raw_mkt = str(row_dict.get("Market", "")).strip()
                canonical_mkt = resolve_market(raw_mkt)
                
                # Prepare record for validation
                record = {
                    "observation_date": obs_date,
                    "crop_id": crop_id,
                    "crop_name": crop_meta["canonical_name"],
                    "original_market_name": raw_mkt,
                    "canonical_market_name": canonical_mkt,
                    "district": TARGET_DISTRICT,
                    "state": TARGET_STATE,
                    "variety": str(row_dict.get("Variety", "FAQ")).strip(),
                    "grade": str(row_dict.get("Grade", "FAQ")).strip(),
                    "min_price": row_dict.get("Min_Price"),
                    "max_price": row_dict.get("Max_Price"),
                    "modal_price": row_dict.get("Modal_Price"),
                    "price_unit": "₹/Quintal",
                    "price_source": fname,
                    "fetched_at": datetime.now().isoformat()
                }
                
                # Validate prices
                is_valid, reason, valid_record = self.validator.validate_price_row(record, crop_id)
                if not is_valid:
                    self.validator.log_rejection(row_dict, reason, "Prices")
                    self.cleaning_stats["prices"]["rejected"] += 1
                    continue
                    
                all_cleaned_records.append(valid_record)
                
        cleaned_df = pd.DataFrame(all_cleaned_records)
        
        # Deduplication based on primary key
        # observation_date + crop_id + canonical_market_name + variety + grade
        initial_len = len(cleaned_df)
        cleaned_df = cleaned_df.drop_duplicates(
            subset=["observation_date", "crop_id", "canonical_market_name", "variety", "grade"],
            keep="last"
        )
        dups_removed = initial_len - len(cleaned_df)
        self.cleaning_stats["prices"]["duplicates_removed"] += dups_removed
        self.cleaning_stats["prices"]["cleaned"] = len(cleaned_df)
        
        # Sort chronologically
        cleaned_df = cleaned_df.sort_values(by=["observation_date", "crop_id", "canonical_market_name"]).reset_index(drop=True)
        
        # Save master cleaned prices
        out_prices_dir = DATASETS_PROCESSED / "prices"
        out_prices_dir.mkdir(parents=True, exist_ok=True)
        master_prices_path = out_prices_dir / "cleaned_prices_all.csv"
        cleaned_df.to_csv(master_prices_path, index=False)
        print(f"Saved master cleaned prices to {master_prices_path} ({len(cleaned_df)} records)")
        
        # Save per-crop cleaned files
        for crop_id in CROPS:
            crop_df = cleaned_df[cleaned_df["crop_id"] == crop_id]
            if not crop_df.empty:
                crop_df.to_csv(out_prices_dir / f"{crop_id}_prices_cleaned.csv", index=False)
                
        return cleaned_df

    def clean_mandi_arrivals(self):
        """Processes and standardizes Agmarknet arrival records."""
        print("Cleaning Mandi Arrivals...")
        arrivals_file = PROJECT_ROOT / "india-mandi-arrivals" / "data" / "agmarknet" / "market_daily_sample.csv.gz"
        if not arrivals_file.exists():
            print(f"Warning: Arrivals file {arrivals_file} does not exist.")
            return pd.DataFrame()
            
        raw_df = pd.read_csv(arrivals_file, compression="gzip")
        self.cleaning_stats["arrivals"]["total_raw"] += len(raw_df)
        
        # Filter to Telangana and Warangal region
        tg_df = raw_df[raw_df["state"] == "Telangana"].copy()
        wgl_districts = ['Warangal', 'Warangal (Urban)', 'Warangal (Rural)', 'Jangaon', 'Mahabubabad', 'Mulugu', 'Jayashankar Bhupalpally', 'Hanumakonda']
        wgl_df = tg_df[tg_df["district"].isin(wgl_districts)].copy()
        
        cleaned_arrivals = []
        for idx, row in wgl_df.iterrows():
            row_dict = row.to_dict()
            obs_date = parse_date_smart(row_dict.get("date"))
            if not obs_date:
                self.validator.log_rejection(row_dict, "Unparseable arrival date", "Arrivals")
                self.cleaning_stats["arrivals"]["rejected"] += 1
                continue
                
            crop_id = resolve_crop_id(row_dict.get("commodity"))
            if not crop_id:
                # Outside our 7 core crops (e.g. potato, tomato)
                continue
                
            crop_meta = CROPS[crop_id]
            raw_mkt = str(row_dict.get("market", "")).strip()
            canonical_mkt = resolve_market(raw_mkt)
            
            arr_qty = row_dict.get("arrival_t")
            if pd.isna(arr_qty) or arr_qty is None:
                status = "NOT_REPORTED"
                arr_val = np.nan
            else:
                try:
                    arr_val = float(arr_qty)
                    if arr_val < 0:
                        self.validator.log_rejection(row_dict, f"Negative arrival quantity: {arr_val}", "Arrivals")
                        self.cleaning_stats["arrivals"]["rejected"] += 1
                        continue
                    status = "REPORTED_POSITIVE" if arr_val > 0 else "REPORTED_ZERO"
                except (ValueError, TypeError):
                    self.validator.log_rejection(row_dict, f"Invalid arrival value: {arr_qty}", "Arrivals")
                    self.cleaning_stats["arrivals"]["rejected"] += 1
                    continue
                    
            entry = {
                "observation_date": obs_date,
                "crop_id": crop_id,
                "crop_name": crop_meta["canonical_name"],
                "original_market_name": raw_mkt,
                "canonical_market_name": canonical_mkt,
                "district": row_dict.get("district", TARGET_DISTRICT),
                "state": TARGET_STATE,
                "arrival_quantity": arr_val,
                "arrival_unit": "Tonnes",
                "arrival_status": status,
                "modal_price": float(row_dict["modal_price_rs_qtl"]) if pd.notnull(row_dict.get("modal_price_rs_qtl")) else np.nan,
                "price_unit": "₹/Quintal",
                "source": "Agmarknet_Daily_Feed"
            }
            cleaned_arrivals.append(entry)
            
        arr_df = pd.DataFrame(cleaned_arrivals)
        if not arr_df.empty:
            arr_df = arr_df.drop_duplicates(subset=["observation_date", "crop_id", "canonical_market_name"], keep="last")
            arr_df = arr_df.sort_values(by=["observation_date", "crop_id", "canonical_market_name"]).reset_index(drop=True)
            
        out_arr_dir = DATASETS_PROCESSED / "arrivals"
        out_arr_dir.mkdir(parents=True, exist_ok=True)
        arr_path = out_arr_dir / "cleaned_arrivals_all.csv"
        arr_df.to_csv(arr_path, index=False)
        self.cleaning_stats["arrivals"]["cleaned"] = len(arr_df)
        print(f"Saved cleaned arrivals to {arr_path} ({len(arr_df)} records)")
        return arr_df

    def clean_trade_statistics(self):
        """Standardizes and structures all national trade files (DGCIS / Department of Commerce)."""
        print("Cleaning National Import & Export Statistics...")
        trade_files = sorted(glob.glob(str(DATASETS_RAW / "*export*")) + glob.glob(str(DATASETS_RAW / "*import*")))
        all_trade = []
        
        for file_path in trade_files:
            fname = os.path.basename(file_path)
            df_t = safe_read_file(file_path, header=None)
            self.cleaning_stats["trade"]["total_raw"] += len(df_t)
            
            crop_str = fname.split("_")[0].replace("imports", "").replace("import", "").replace("exports", "").replace("export", "")
            crop_id = resolve_crop_id(crop_str)
            trade_dir = "Export" if "export" in fname.lower() else "Import"
            
            # Find header row containing HSCode or Commodity
            header_idx = None
            for idx, row in df_t.iterrows():
                row_vals = [str(x).lower() for x in row.values if pd.notna(x)]
                if any("hscode" in x or "s.no." in x for x in row_vals):
                    header_idx = idx
                    break
                    
            if header_idx is None:
                self.validator.log_rejection({"file": fname}, "Header row not found", "Trade")
                self.cleaning_stats["trade"]["rejected"] += 1
                continue
                
            headers = [str(x).strip() for x in df_t.iloc[header_idx].values]
            
            # Locate fiscal year columns
            fy_col_pairs = []
            for c_idx, h in enumerate(headers):
                if any(yr in h for yr in ["2021", "2022", "2023", "2024", "2025", "2026"]) and "%" not in h:
                    fy_col_pairs.append((c_idx, h))
                    
            data_rows = df_t.iloc[header_idx + 1:]
            for r_idx, row in data_rows.iterrows():
                # Skip India total rows
                first_cell = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
                second_cell = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
                if "total" in first_cell.lower() or "total" in second_cell.lower() or pd.isna(row.iloc[1]):
                    continue
                    
                hs_code = str(row.iloc[1]).strip()
                commodity_desc = str(row.iloc[2]).strip()
                
                for col_idx, fy_name in fy_col_pairs:
                    val = row.iloc[col_idx]
                    try:
                        val_num = float(val) if pd.notnull(val) else np.nan
                    except (ValueError, TypeError):
                        val_num = np.nan
                        
                    growth_val = np.nan
                    # Check if next columns contain %Growth
                    if col_idx + 2 < len(row):
                        try:
                            growth_val = float(row.iloc[col_idx + 2])
                        except (ValueError, TypeError):
                            growth_val = np.nan
                            
                    entry = {
                        "fiscal_year": fy_name,
                        "crop_id": crop_id,
                        "commodity_description": commodity_desc,
                        "trade_direction": trade_dir,
                        "hs_code": hs_code,
                        "monetary_value_crore_inr": val_num,
                        "pct_growth": growth_val,
                        "currency": "INR",
                        "unit": "₹ Crore",
                        "scope": "NATIONAL_INDIA",
                        "source": fname
                    }
                    all_trade.append(entry)
                    
        trade_df = pd.DataFrame(all_trade)
        if not trade_df.empty:
            trade_df = trade_df.drop_duplicates(subset=["fiscal_year", "crop_id", "trade_direction", "hs_code"]).reset_index(drop=True)
            
        out_trade_dir = DATASETS_PROCESSED / "trade"
        out_trade_dir.mkdir(parents=True, exist_ok=True)
        trade_path = out_trade_dir / "cleaned_trade_all.csv"
        trade_df.to_csv(trade_path, index=False)
        self.cleaning_stats["trade"]["cleaned"] = len(trade_df)
        print(f"Saved cleaned national trade data to {trade_path} ({len(trade_df)} records)")
        return trade_df

    def run_pipeline(self):
        """Runs the complete cleaning pipeline and generates reports."""
        prices_df = self.clean_historical_prices()
        arrivals_df = self.clean_mandi_arrivals()
        trade_df = self.clean_trade_statistics()
        
        # Save rejected records
        rejected_df = self.validator.get_rejected_dataframe()
        rejected_path = DATASETS_REPORTS / "rejected_records.csv"
        rejected_df.to_csv(rejected_path, index=False)
        print(f"Saved rejected records report to {rejected_path} ({len(rejected_df)} records)")
        
        # Save cleaning report JSON
        report_data = {
            "pipeline_executed_at": datetime.now().isoformat(),
            "target_district": TARGET_DISTRICT,
            "target_state": TARGET_STATE,
            "cleaning_statistics": self.cleaning_stats,
            "rejected_records_count": len(rejected_df),
            "rejection_reasons_summary": rejected_df["rejection_reason"].value_counts().to_dict() if not rejected_df.empty else {}
        }
        report_path = DATASETS_REPORTS / "cleaning_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        print(f"Saved cleaning report to {report_path}")

if __name__ == "__main__":
    cleaner = DataCleaner()
    cleaner.run_pipeline()
