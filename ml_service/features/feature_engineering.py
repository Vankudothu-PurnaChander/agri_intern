"""Feature Engineering Module for Price Forecasting.
Extracts strictly backward-looking price, arrival, temporal, and macro trade features
with zero future leakage. Constructs multi-horizon targets (1, 15, 30, 60, 90 days).
"""
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

from ml_service.config import CROPS, DATASETS_PROCESSED

class FeatureEngineer:
    def __init__(self, data_path=None, trade_path=None):
        if data_path is None:
            data_path = DATASETS_PROCESSED / "integrated" / "integrated_price_arrival_dataset.csv"
        if trade_path is None:
            trade_path = DATASETS_PROCESSED / "integrated" / "integrated_trade_dataset.csv"
            
        self.data_path = Path(data_path)
        self.trade_path = Path(trade_path)
        self.df = pd.read_csv(self.data_path) if self.data_path.exists() else pd.DataFrame()
        self.trade_df = pd.read_csv(self.trade_path) if self.trade_path.exists() else pd.DataFrame()
        
    def _season_from_month(self, month):
        # Kharif: June (6) to October (10)
        # Rabi: November (11) to March (3)
        # Zaid: April (4) to May (5)
        if 6 <= month <= 10:
            return 1  # Kharif
        elif month in [11, 12, 1, 2, 3]:
            return 2  # Rabi
        else:
            return 3  # Zaid

    MIN_OBSERVATIONS = 100      # distinct reported price days required for a market-specific forecast
    MAX_STALE_DAYS = 120        # latest observation must be this recent

    def support_table(self):
        """Per crop-market usable-observation summary computed from real data only."""
        if self.df.empty:
            return []
        d = self.df.copy()
        d["observation_date"] = pd.to_datetime(d["observation_date"])
        rows = []
        for (crop, mkt), g in d.groupby(["crop_id", "canonical_market_name"]):
            n = int(g["observation_date"].nunique())
            last = g["observation_date"].max()
            first = g["observation_date"].min()
            reason = None
            if n < self.MIN_OBSERVATIONS:
                reason = "INSUFFICIENT_OBSERVATIONS"
            elif (pd.Timestamp.now().normalize() - last).days > self.MAX_STALE_DAYS:
                reason = "STALE_DATA"
            rows.append({
                "crop_id": crop, "market_name": mkt, "observations": n,
                "first_date": first.strftime("%Y-%m-%d"), "last_date": last.strftime("%Y-%m-%d"),
                "arrival_days": int(g.loc[g["arrival_available"] == 1, "observation_date"].nunique())
                if "arrival_available" in g else 0,
                "supported": reason is None, "reason": reason,
            })

        # Add district-wide aggregate for each crop
        for crop, g in d.groupby("crop_id"):
            n_dist = int(g["observation_date"].nunique())
            last_dist = g["observation_date"].max()
            first_dist = g["observation_date"].min()
            dist_reason = None
            if n_dist < 50:
                dist_reason = "INSUFFICIENT_OBSERVATIONS"
            elif (pd.Timestamp.now().normalize() - last_dist).days > self.MAX_STALE_DAYS:
                dist_reason = "STALE_DATA"
            rows.append({
                "crop_id": crop, "market_name": "Warangal District Aggregate", "observations": n_dist,
                "first_date": first_dist.strftime("%Y-%m-%d"), "last_date": last_dist.strftime("%Y-%m-%d"),
                "arrival_days": int(g.loc[g["arrival_available"] == 1, "observation_date"].nunique())
                if "arrival_available" in g else 0,
                "supported": dist_reason is None, "reason": dist_reason,
            })
        return rows

    def build_features_for_crop(self, crop_id, market_name=None, horizon_days=15):
        """Constructs leakage-free engineered feature table for a given crop and horizon."""
        sub = self.df[self.df["crop_id"] == crop_id].copy()
        if market_name and market_name != "Warangal District Aggregate":
            sub = sub[sub["canonical_market_name"] == market_name]
            
        if sub.empty:
            return pd.DataFrame()
            
        sub["observation_date"] = pd.to_datetime(sub["observation_date"])
        # Aggregate to one row per date if multiple entries exist
        daily = sub.groupby("observation_date").agg(
            modal_price=("modal_price", "median"),
            min_price=("minimum_price", "min"),
            max_price=("maximum_price", "max"),
            arrival_quantity=("arrival_quantity", "sum"),
            arrival_available=("arrival_available", "max")
        ).reset_index()
        
        # Sort chronologically
        daily = daily.sort_values("observation_date").set_index("observation_date")
        
        # Resample to daily frequency to ensure true time-series continuity
        # Forward fill modal price up to 7 calendar days to bridge weekend market closures
        full_idx = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
        daily = daily.reindex(full_idx)
        
        # Forward-fill prices for lagged feature calculation only
        daily["modal_price_ffill"] = daily["modal_price"].ffill(limit=7)
        daily["min_price_ffill"] = daily["min_price"].ffill(limit=7)
        daily["max_price_ffill"] = daily["max_price"].ffill(limit=7)
        
        # Handle arrivals: do NOT forward fill arrival quantities, missing arrivals stay nan or 0 for lag averages
        daily["arrival_is_missing"] = daily["arrival_quantity"].isna().astype(int)
        daily["arrival_qty_clean"] = daily["arrival_quantity"].fillna(0)
        
        # -------------------------------------------------------------
        # 1. Price Lag Features (Strictly Backward-Looking)
        # -------------------------------------------------------------
        df_feat = pd.DataFrame(index=daily.index)
        df_feat["price_lag_1"] = daily["modal_price_ffill"].shift(1)
        df_feat["price_lag_2"] = daily["modal_price_ffill"].shift(2)
        df_feat["price_lag_3"] = daily["modal_price_ffill"].shift(3)
        df_feat["price_lag_7"] = daily["modal_price_ffill"].shift(7)
        df_feat["price_lag_14"] = daily["modal_price_ffill"].shift(14)
        df_feat["price_lag_15"] = daily["modal_price_ffill"].shift(15)
        df_feat["price_lag_30"] = daily["modal_price_ffill"].shift(30)
        
        # -------------------------------------------------------------
        # 2. Rolling Price Statistics (Backward Looking on Shifted Series)
        # -------------------------------------------------------------
        p_shifted = daily["modal_price_ffill"].shift(1)
        df_feat["price_rolling_mean_7"] = p_shifted.rolling(7).mean()
        df_feat["price_rolling_mean_15"] = p_shifted.rolling(15).mean()
        df_feat["price_rolling_mean_30"] = p_shifted.rolling(30).mean()
        df_feat["price_rolling_median_7"] = p_shifted.rolling(7).median()
        df_feat["price_rolling_median_15"] = p_shifted.rolling(15).median()
        df_feat["price_rolling_std_7"] = p_shifted.rolling(7).std().fillna(0)
        df_feat["price_rolling_std_15"] = p_shifted.rolling(15).std().fillna(0)
        
        # Price Momentum & Percentage Changes
        df_feat["price_pct_change_1"] = p_shifted.pct_change(1).fillna(0)
        df_feat["price_pct_change_7"] = p_shifted.pct_change(7).fillna(0)
        df_feat["price_pct_change_15"] = p_shifted.pct_change(15).fillna(0)
        
        # Min/Max Spread
        min_shifted = daily["min_price_ffill"].shift(1)
        max_shifted = daily["max_price_ffill"].shift(1)
        df_feat["price_spread_lag_1"] = (max_shifted - min_shifted) / (p_shifted + 1e-5)
        
        # -------------------------------------------------------------
        # 3. Mandi Arrival Features
        # -------------------------------------------------------------
        arr_shifted = daily["arrival_qty_clean"].shift(1)
        df_feat["arrival_lag_1"] = arr_shifted
        df_feat["arrival_lag_3"] = daily["arrival_qty_clean"].shift(3)
        df_feat["arrival_lag_7"] = daily["arrival_qty_clean"].shift(7)
        df_feat["arrival_lag_15"] = daily["arrival_qty_clean"].shift(15)
        
        df_feat["arrival_rolling_mean_3"] = arr_shifted.rolling(3).mean()
        df_feat["arrival_rolling_mean_7"] = arr_shifted.rolling(7).mean()
        df_feat["arrival_rolling_mean_15"] = arr_shifted.rolling(15).mean()
        df_feat["arrival_rolling_mean_30"] = arr_shifted.rolling(30).mean()
        df_feat["arrival_pct_change_7"] = arr_shifted.pct_change(7).replace([np.inf, -np.inf], 0).fillna(0)
        df_feat["arrival_missing_ratio_15"] = daily["arrival_is_missing"].shift(1).rolling(15).mean().fillna(1.0)
        
        # -------------------------------------------------------------
        # 4. Temporal & Calendar Features
        # -------------------------------------------------------------
        df_feat["day_of_week"] = df_feat.index.day_of_week if hasattr(df_feat.index, "day_of_week") else df_feat.index.dayofweek
        df_feat["month"] = df_feat.index.month
        df_feat["day_of_month"] = df_feat.index.day
        df_feat["year"] = df_feat.index.year
        df_feat["season"] = [self._season_from_month(m) for m in df_feat["month"]]
        df_feat["is_weekend"] = (df_feat["day_of_week"] >= 5).astype(int)
        
        # Cyclical Encodings
        df_feat["sin_month"] = np.sin(2 * np.pi * df_feat["month"] / 12)
        df_feat["cos_month"] = np.cos(2 * np.pi * df_feat["month"] / 12)
        df_feat["sin_day"] = np.sin(2 * np.pi * df_feat["day_of_month"] / 31)
        df_feat["cos_day"] = np.cos(2 * np.pi * df_feat["day_of_month"] / 31)
        
        # -------------------------------------------------------------
        # 5. Macro National Trade Contextual Indicators (Lagged Fiscal Year)
        # -------------------------------------------------------------
        if not self.trade_df.empty:
            crop_trade = self.trade_df[self.trade_df["crop_id"] == crop_id]
            if not crop_trade.empty:
                # Map date to lagged fiscal year (preventing leakage)
                # If date is in 2024-25, only previous completed year (2023-24) data is known
                def get_lagged_trade(dt):
                    fy_start = dt.year - 1 if dt.month >= 4 else dt.year - 2
                    prev_fy_str = f"{fy_start} - {fy_start + 1}"
                    match = crop_trade[crop_trade["fiscal_year"].str.contains(str(fy_start), na=False)]
                    if not match.empty:
                        exp = match["export_total_value_crore"].values[0] if "export_total_value_crore" in match else 0
                        imp = match["import_total_value_crore"].values[0] if "import_total_value_crore" in match else 0
                        bal = match["trade_balance_crore"].values[0] if "trade_balance_crore" in match else (exp - imp)
                        return exp, imp, bal
                    return 0, 0, 0
                    
                trade_records = [get_lagged_trade(dt) for dt in df_feat.index]
                df_feat["trade_export_lag_crore"] = [t[0] for t in trade_records]
                df_feat["trade_import_lag_crore"] = [t[1] for t in trade_records]
                df_feat["trade_balance_lag_crore"] = [t[2] for t in trade_records]
                
        # -------------------------------------------------------------
        # 6. Forecasting Targets (Multi-Horizon: Strictly Actual Traded Prices)
        # -------------------------------------------------------------
        # Targets are based on actual observed modal prices at t + horizon.
        # For non-trading market closures, backfill to the next actual traded auction within 2 days.
        actual_trade_price = daily["modal_price"].bfill(limit=2)
        df_feat["target_1d"] = actual_trade_price.shift(-1)
        df_feat["target_7d"] = actual_trade_price.shift(-7)
        df_feat["target_15d"] = actual_trade_price.shift(-15)
        df_feat["target_30d"] = actual_trade_price.shift(-30)
        
        # Primary target for the requested horizon
        target_col = f"target_{horizon_days}d"
        if target_col in df_feat.columns:
            df_feat["target"] = df_feat[target_col]
        else:
            df_feat["target"] = actual_trade_price.shift(-horizon_days)
        
        # Metadata
        df_feat["crop_id"] = crop_id
        df_feat["market_name"] = market_name or "Warangal District Aggregate"
        df_feat["observation_date"] = df_feat.index.strftime("%Y-%m-%d")
        
        # Fill missing values for earlier lags if series is shorter than 30 days
        for col in ["price_lag_30", "price_lag_15", "price_lag_14", "price_lag_7", "price_lag_3", "price_lag_2"]:
            if col in df_feat.columns:
                df_feat[col] = df_feat[col].fillna(df_feat["price_lag_1"])
        for col in ["price_rolling_mean_30", "price_rolling_mean_15", "price_rolling_median_15"]:
            if col in df_feat.columns:
                df_feat[col] = df_feat[col].fillna(df_feat["price_rolling_mean_7"]).fillna(df_feat["price_lag_1"])

        # Drop rows where immediate price_lag_1 is missing
        df_feat = df_feat.dropna(subset=["price_lag_1"])
        return df_feat.reset_index(drop=True)

if __name__ == "__main__":
    fe = FeatureEngineer()
    for c in ["cotton", "maize", "dry_chillies"]:
        df_f = fe.build_features_for_crop(c, horizon_days=15)
        print(f"Features for {c}: {df_f.shape[0]} rows, {df_f.shape[1]} columns")
