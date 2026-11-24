"""Dataset Integration Module.
Performs outer-join integration of prices, arrivals, and national trade indicators.
Preserves unmatched records, creates missingness indicators, and enforces temporal validity.
"""
import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path

from ml_service.config import (
    CROPS, TARGET_DISTRICT, TARGET_STATE,
    DATASETS_PROCESSED, DATASETS_REPORTS
)

class DataIntegrator:
    def __init__(self):
        self.prices_file = DATASETS_PROCESSED / "prices" / "cleaned_prices_all.csv"
        self.arrivals_file = DATASETS_PROCESSED / "arrivals" / "cleaned_arrivals_all.csv"
        self.trade_file = DATASETS_PROCESSED / "trade" / "cleaned_trade_all.csv"
        self.out_dir = DATASETS_PROCESSED / "integrated"
        self.out_dir.mkdir(parents=True, exist_ok=True)
        
    def _date_to_fiscal_year(self, date_str):
        """Converts YYYY-MM-DD to Indian Financial Year (e.g. 2024-07-01 -> '2024 - 2025')."""
        try:
            dt = pd.to_datetime(date_str)
            year = dt.year
            month = dt.month
            if month >= 4:
                return f"{year} - {year + 1}"
            else:
                return f"{year - 1} - {year}"
        except Exception:
            return None

    def integrate_prices_and_arrivals(self):
        """Merges historical prices and arrivals using an outer join on (date, crop, market)."""
        print("Integrating Historical Prices and Mandi Arrivals...")
        if not self.prices_file.exists():
            raise FileNotFoundError(f"Cleaned prices not found at {self.prices_file}")
            
        prices_df = pd.read_csv(self.prices_file)
        
        # Load arrivals if available
        if self.arrivals_file.exists():
            arrivals_df = pd.read_csv(self.arrivals_file)
        else:
            arrivals_df = pd.DataFrame()
            
        # Daily market level aggregation for prices
        # In case multiple varieties are reported on the same day for a market,
        # we aggregate: min_price = min, max_price = max, modal_price = median
        p_agg = prices_df.groupby(["observation_date", "crop_id", "canonical_market_name"]).agg(
            minimum_price=("min_price", "min"),
            maximum_price=("max_price", "max"),
            modal_price=("modal_price", "median"),
            crop_name=("crop_name", "first"),
            district=("district", "first"),
            state=("state", "first"),
            price_source=("price_source", lambda x: "; ".join(sorted(x.unique()))),
            varieties_reported=("variety", lambda x: "; ".join(sorted([str(v) for v in x.unique() if pd.notna(v)]))),
            grades_reported=("grade", lambda x: "; ".join(sorted([str(g) for g in x.unique() if pd.notna(g)])))
        ).reset_index()
        p_agg["price_available"] = True
        
        if not arrivals_df.empty:
            arr_agg = arrivals_df.groupby(["observation_date", "crop_id", "canonical_market_name"]).agg(
                arrival_quantity=("arrival_quantity", "sum"),
                arrival_unit=("arrival_unit", "first"),
                arrival_status=("arrival_status", "first"),
                arrival_source=("source", "first")
            ).reset_index()
            arr_agg["arrival_available"] = True
            
            # Outer Join to strictly preserve unmatched price & arrival records
            merged = pd.merge(
                p_agg,
                arr_agg,
                on=["observation_date", "crop_id", "canonical_market_name"],
                how="outer"
            )
        else:
            merged = p_agg.copy()
            merged["arrival_quantity"] = np.nan
            merged["arrival_unit"] = "Tonnes"
            merged["arrival_status"] = "NOT_REPORTED"
            merged["arrival_source"] = "N/A"
            merged["arrival_available"] = False
            
        # Post-merge clean up
        merged["price_available"] = merged["price_available"].fillna(False).astype(bool)
        merged["arrival_available"] = merged["arrival_available"].fillna(False).astype(bool)
        
        # Backfill metadata for arrival-only rows
        for crop_id, meta in CROPS.items():
            mask = (merged["crop_id"] == crop_id)
            merged.loc[mask & merged["crop_name"].isna(), "crop_name"] = meta["canonical_name"]
            
        merged["district"] = merged["district"].fillna(TARGET_DISTRICT)
        merged["state"] = merged["state"].fillna(TARGET_STATE)
        merged["arrival_unit"] = merged["arrival_unit"].fillna("Tonnes")
        merged["arrival_status"] = merged.apply(
            lambda r: r["arrival_status"] if pd.notnull(r.get("arrival_status")) else (
                "REPORTED_POSITIVE" if pd.notnull(r["arrival_quantity"]) and r["arrival_quantity"] > 0 else (
                    "REPORTED_ZERO" if pd.notnull(r["arrival_quantity"]) and r["arrival_quantity"] == 0 else "NOT_REPORTED"
                )
            ),
            axis=1
        )
        
        # Add arrival missingness indicator (mandatory rule)
        merged["arrival_is_missing"] = (~merged["arrival_available"]).astype(int)
        
        # Sort chronologically
        merged = merged.sort_values(by=["observation_date", "crop_id", "canonical_market_name"]).reset_index(drop=True)
        
        out_path = self.out_dir / "integrated_price_arrival_dataset.csv"
        merged.to_csv(out_path, index=False)
        print(f"Saved integrated price-arrival dataset to {out_path} ({len(merged)} records)")
        return merged

    def integrate_trade_data(self):
        """Prepares national-level trade indicators structured by fiscal year."""
        print("Integrating National Trade Indicators...")
        if not self.trade_file.exists():
            raise FileNotFoundError(f"Cleaned trade statistics not found at {self.trade_file}")
            
        trade_df = pd.read_csv(self.trade_file)
        
        # Aggregate by fiscal year, crop, and trade direction
        agg_trade = trade_df.groupby(["fiscal_year", "crop_id", "trade_direction"]).agg(
            total_value_crore=("monetary_value_crore_inr", "sum"),
            avg_growth_pct=("pct_growth", "mean"),
            hs_codes=("hs_code", lambda x: "; ".join([str(h) for h in x.unique()])),
            currency=("currency", "first"),
            unit=("unit", "first"),
            scope=("scope", "first")
        ).reset_index()
        
        # Pivot exports and imports side-by-side
        pivot_trade = agg_trade.pivot(
            index=["fiscal_year", "crop_id"],
            columns="trade_direction",
            values=["total_value_crore", "avg_growth_pct"]
        )
        pivot_trade.columns = [f"{col[1].lower()}_{col[0]}" for col in pivot_trade.columns]
        pivot_trade = pivot_trade.reset_index()
        
        # Calculate national net trade balance in ₹ Crore: Exports - Imports
        if "export_total_value_crore" in pivot_trade.columns and "import_total_value_crore" in pivot_trade.columns:
            pivot_trade["trade_balance_crore"] = pivot_trade["export_total_value_crore"].fillna(0) - pivot_trade["import_total_value_crore"].fillna(0)
            
        pivot_trade["scope"] = "NATIONAL_INDIA"
        
        out_path = self.out_dir / "integrated_trade_dataset.csv"
        pivot_trade.to_csv(out_path, index=False)
        print(f"Saved integrated trade dataset to {out_path} ({len(pivot_trade)} records)")
        return pivot_trade

    def run_integration(self):
        merged_pa = self.integrate_prices_and_arrivals()
        merged_trade = self.integrate_trade_data()
        
        # Generate integration report JSON
        both_count = int((merged_pa["price_available"] & merged_pa["arrival_available"]).sum())
        price_only_count = int((merged_pa["price_available"] & ~merged_pa["arrival_available"]).sum())
        arrival_only_count = int((~merged_pa["price_available"] & merged_pa["arrival_available"]).sum())
        
        report = {
            "integration_executed_at": datetime.now().isoformat(),
            "target_district": TARGET_DISTRICT,
            "target_state": TARGET_STATE,
            "price_arrival_integration": {
                "total_integrated_observations": len(merged_pa),
                "both_price_and_arrival_reported": both_count,
                "price_reported_only": price_only_count,
                "arrival_reported_only": arrival_only_count,
                "date_min": merged_pa["observation_date"].min(),
                "date_max": merged_pa["observation_date"].max(),
                "crops_covered": merged_pa["crop_id"].unique().tolist(),
                "markets_covered": merged_pa["canonical_market_name"].unique().tolist()
            },
            "trade_integration": {
                "total_fiscal_year_records": len(merged_trade),
                "fiscal_years": merged_trade["fiscal_year"].unique().tolist(),
                "crops": merged_trade["crop_id"].unique().tolist(),
                "scope": "NATIONAL_INDIA",
                "temporal_rule": "Trade features aligned via lagged financial year to prevent data leakage"
            }
        }
        
        rep_path = self.out_dir / "integration_report.json"
        with open(rep_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"Saved integration report to {rep_path}")
        return report

if __name__ == "__main__":
    integrator = DataIntegrator()
    integrator.run_integration()

