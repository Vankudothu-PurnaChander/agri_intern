"""High-Performance Bulk Data Loader for MongoDB Atlas.
Loads historical cleaned datasets (Prices, Arrivals, Trade) into MongoDB Atlas
using idempotent bulk_write operations with batching, progress reporting,
duplicate detection, and audit logging.
"""
import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
import pandas as pd
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError, PyMongoError

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.stdout.reconfigure(encoding='utf-8')

from ml_service.config import CROPS, WARANGAL_MARKETS

DATASETS_DIR = PROJECT_ROOT / "datasets" / "processed"
REPORTS_DIR = PROJECT_ROOT / "datasets" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

class BulkDataLoader:
    def __init__(self, uri=None, batch_size=2000):
        self.batch_size = batch_size
        if uri is None:
            # Load from backend/.env if available
            env_file = PROJECT_ROOT / "backend" / ".env"
            if env_file.exists():
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("MONGODB_URI="):
                            uri = line.strip().split("=", 1)[1].strip('"\'')
                            break
                            
        self.uri = uri or os.getenv("MONGODB_URI")
        if not self.uri:
            raise ValueError("MONGODB_URI not found in environment or backend/.env")
            
        print(f"Connecting to MongoDB Atlas at {self.uri.split('@')[-1]}...")
        self.client = MongoClient(self.uri, serverSelectionTimeoutMS=8000)
        self.db = self.client.get_default_database("test")
        print(f"Connected to database: '{self.db.name}'")
        
        self.stats = {
            "started_at": datetime.now().isoformat(),
            "batch_size": self.batch_size,
            "prices": {"total": 0, "upserted": 0, "skipped_duplicates": 0, "rejected": 0, "duration_sec": 0},
            "arrivals": {"total": 0, "upserted": 0, "skipped_duplicates": 0, "rejected": 0, "duration_sec": 0},
            "trades": {"total": 0, "upserted": 0, "skipped_duplicates": 0, "rejected": 0, "duration_sec": 0}
        }

    def import_prices(self):
        """Bulk loads cleaned_prices_all.csv into the 'prices' collection."""
        csv_path = DATASETS_DIR / "prices" / "cleaned_prices_all.csv"
        if not csv_path.exists():
            print(f"⚠️ Prices dataset not found: {csv_path}")
            return
            
        print(f"\n📂 Reading historical prices from {csv_path}...")
        t0 = time.time()
        df = pd.read_csv(csv_path)
        total_rows = len(df)
        self.stats["prices"]["total"] = total_rows
        print(f"Total raw price records to process: {total_rows:,}")
        
        coll = self.db["prices"]
        operations = []
        upserted_count = 0
        rejected_count = 0
        seen_keys = set()
        skipped_dupes = 0
        
        for idx, row in df.iterrows():
            # Validate required fields
            obs_date = str(row.get("observation_date", "")).strip()
            crop_id = str(row.get("crop_id", "")).strip().lower()
            market_name = str(row.get("canonical_market_name", "")).strip()
            variety = str(row.get("variety", "FAQ")).strip() or "FAQ"
            grade = str(row.get("grade", "FAQ")).strip() or "FAQ"
            
            try:
                min_p = float(row.get("min_price", 0))
                max_p = float(row.get("max_price", 0))
                modal_p = float(row.get("modal_price", 0))
            except (ValueError, TypeError):
                rejected_count += 1
                continue
                
            if not obs_date or not crop_id or not market_name or modal_p <= 0:
                rejected_count += 1
                continue
                
            unique_key = (obs_date, crop_id, market_name, variety, grade)
            if unique_key in seen_keys:
                skipped_dupes += 1
                continue
            seen_keys.add(unique_key)
            
            doc = {
                "observation_date": obs_date,
                "crop_id": crop_id,
                "crop_name": row.get("crop_name", crop_id.title()),
                "canonical_market_name": market_name,
                "district": row.get("district", "Warangal"),
                "state": row.get("state", "Telangana"),
                "variety": variety,
                "grade": grade,
                "min_price": min_p,
                "max_price": max_p,
                "modal_price": modal_p,
                "price_unit": "₹/Quintal",
                "price_source": row.get("price_source", "Agmarknet"),
                "fetched_at": datetime.now()
            }
            
            # Idempotent upsert operation
            filter_query = {
                "observation_date": obs_date,
                "crop_id": crop_id,
                "canonical_market_name": market_name,
                "variety": variety,
                "grade": grade
            }
            operations.append(UpdateOne(filter_query, {"$set": doc}, upsert=True))
            
            # Flush batch
            if len(operations) >= self.batch_size:
                try:
                    res = coll.bulk_write(operations, ordered=False)
                    upserted_count += (res.upserted_count + res.modified_count + res.matched_count)
                    batch_num = upserted_count // self.batch_size
                    print(f"   [Prices Batch {batch_num}] Processed {upserted_count:,} / {total_rows:,} records...")
                except BulkWriteError as bwe:
                    print(f"   ⚠️ BulkWriteError: {bwe.details.get('nUpserted', 0)} upserted with partial errors.")
                operations = []
                
        # Final residual batch
        if operations:
            try:
                res = coll.bulk_write(operations, ordered=False)
                upserted_count += (res.upserted_count + res.modified_count + res.matched_count)
            except BulkWriteError as bwe:
                pass
                
        duration = round(time.time() - t0, 2)
        self.stats["prices"]["upserted"] = upserted_count
        self.stats["prices"]["skipped_duplicates"] = skipped_dupes
        self.stats["prices"]["rejected"] = rejected_count
        self.stats["prices"]["duration_sec"] = duration
        print(f"✅ Prices Import Complete: {upserted_count:,} upserted, {skipped_dupes} dupes skipped, {rejected_count} rejected ({duration}s).")

    def import_arrivals(self):
        """Bulk loads cleaned_arrivals_all.csv into the 'arrivals' collection."""
        csv_path = DATASETS_DIR / "arrivals" / "cleaned_arrivals_all.csv"
        if not csv_path.exists():
            print(f"⚠️ Arrivals dataset not found: {csv_path}")
            return
            
        print(f"\n📂 Reading historical arrivals from {csv_path}...")
        t0 = time.time()
        df = pd.read_csv(csv_path)
        total_rows = len(df)
        self.stats["arrivals"]["total"] = total_rows
        
        coll = self.db["arrivals"]
        operations = []
        upserted_count = 0
        rejected_count = 0
        seen_keys = set()
        skipped_dupes = 0
        
        for idx, row in df.iterrows():
            obs_date = str(row.get("observation_date", "")).strip()
            crop_id = str(row.get("crop_id", "")).strip().lower()
            market_name = str(row.get("canonical_market_name", "")).strip()
            
            try:
                qty = float(row.get("arrival_quantity", 0)) if pd.notna(row.get("arrival_quantity")) else None
            except (ValueError, TypeError):
                qty = None
                
            if not obs_date or not crop_id or not market_name:
                rejected_count += 1
                continue
                
            unique_key = (obs_date, crop_id, market_name)
            if unique_key in seen_keys:
                skipped_dupes += 1
                continue
            seen_keys.add(unique_key)
            
            doc = {
                "observation_date": obs_date,
                "crop_id": crop_id,
                "crop_name": row.get("crop_name", crop_id.title()),
                "canonical_market_name": market_name,
                "district": row.get("district", "Warangal"),
                "state": row.get("state", "Telangana"),
                "arrival_quantity": qty,
                "arrival_unit": row.get("arrival_unit", "Tonnes"),
                "arrival_status": row.get("arrival_status", "REPORTED_POSITIVE"),
                "modal_price": float(row.get("modal_price", 0)) if pd.notna(row.get("modal_price")) else None,
                "source": row.get("source", "Agmarknet"),
                "updated_at": datetime.now()
            }
            
            filter_query = {
                "observation_date": obs_date,
                "crop_id": crop_id,
                "canonical_market_name": market_name
            }
            operations.append(UpdateOne(filter_query, {"$set": doc}, upsert=True))
            
            if len(operations) >= self.batch_size:
                try:
                    res = coll.bulk_write(operations, ordered=False)
                    upserted_count += (res.upserted_count + res.modified_count + res.matched_count)
                except BulkWriteError:
                    pass
                operations = []
                
        if operations:
            try:
                res = coll.bulk_write(operations, ordered=False)
                upserted_count += (res.upserted_count + res.modified_count + res.matched_count)
            except BulkWriteError:
                pass
                
        duration = round(time.time() - t0, 2)
        self.stats["arrivals"]["upserted"] = upserted_count
        self.stats["arrivals"]["skipped_duplicates"] = skipped_dupes
        self.stats["arrivals"]["rejected"] = rejected_count
        self.stats["arrivals"]["duration_sec"] = duration
        print(f"✅ Arrivals Import Complete: {upserted_count:,} upserted, {skipped_dupes} dupes skipped, {rejected_count} rejected ({duration}s).")

    def import_trades(self):
        """Bulk loads cleaned_trade_all.csv into the 'trades' collection."""
        csv_path = DATASETS_DIR / "trade" / "cleaned_trade_all.csv"
        if not csv_path.exists():
            print(f"⚠️ Trade dataset not found: {csv_path}")
            return
            
        print(f"\n📂 Reading trade statistics from {csv_path}...")
        t0 = time.time()
        df = pd.read_csv(csv_path)
        total_rows = len(df)
        self.stats["trades"]["total"] = total_rows
        
        coll = self.db["trades"]
        operations = []
        upserted_count = 0
        seen_keys = set()
        skipped_dupes = 0
        rejected_count = 0
        
        for idx, row in df.iterrows():
            fy = str(row.get("fiscal_year", "")).strip()
            crop_id = str(row.get("crop_id", "")).strip().lower()
            direction = str(row.get("trade_direction", "")).strip()
            hs_code = str(row.get("hs_code", "")).strip()
            
            try:
                val = float(row.get("monetary_value_crore_inr", 0))
            except (ValueError, TypeError):
                rejected_count += 1
                continue
                
            unique_key = (fy, crop_id, direction, hs_code)
            if unique_key in seen_keys:
                skipped_dupes += 1
                continue
            seen_keys.add(unique_key)
            
            doc = {
                "fiscal_year": fy,
                "crop_id": crop_id,
                "trade_direction": direction,
                "hs_code": hs_code,
                "monetary_value_crore_inr": val,
                "pct_growth": float(row.get("pct_growth", 0)) if pd.notna(row.get("pct_growth")) else None,
                "currency": "INR",
                "unit": "₹ Crore",
                "scope": "NATIONAL_INDIA",
                "source": row.get("source", "DGCIS"),
                "updated_at": datetime.now()
            }
            
            filter_query = {
                "fiscal_year": fy,
                "crop_id": crop_id,
                "trade_direction": direction,
                "hs_code": hs_code
            }
            operations.append(UpdateOne(filter_query, {"$set": doc}, upsert=True))
            
        if operations:
            try:
                res = coll.bulk_write(operations, ordered=False)
                upserted_count += (res.upserted_count + res.modified_count + res.matched_count)
            except BulkWriteError:
                pass
                
        duration = round(time.time() - t0, 2)
        self.stats["trades"]["upserted"] = upserted_count
        self.stats["trades"]["skipped_duplicates"] = skipped_dupes
        self.stats["trades"]["rejected"] = rejected_count
        self.stats["trades"]["duration_sec"] = duration
        print(f"✅ Trade Import Complete: {upserted_count:,} upserted, {skipped_dupes} dupes skipped, {rejected_count} rejected ({duration}s).")

    def execute_full_import(self):
        print("=" * 60)
        print("🚀 STARTING IDEMPOTENT HIGH-SPEED BULK IMPORT TO MONGODB ATLAS")
        print("=" * 60)
        start_time = time.time()
        
        self.import_prices()
        self.import_arrivals()
        self.import_trades()
        
        total_time = round(time.time() - start_time, 2)
        self.stats["finished_at"] = datetime.now().isoformat()
        self.stats["total_duration_sec"] = total_time
        self.stats["status"] = "COMPLETED"
        
        # Save audit report
        report_file = REPORTS_DIR / "bulk_import_report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(self.stats, f, indent=2)
            
        print("\n" + "=" * 60)
        print(f"🎉 BULK IMPORT COMPLETED IN {total_time}s")
        print(f"Detailed audit saved to {report_file}")
        print("=" * 60)
        return self.stats

if __name__ == "__main__":
    loader = BulkDataLoader(batch_size=2500)
    loader.execute_full_import()
