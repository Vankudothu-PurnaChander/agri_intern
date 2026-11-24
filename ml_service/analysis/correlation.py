"""Statistical Analysis Module for Price-Arrival Relationships.
Implements Pearson, Spearman, Lagged cross-correlation, Rolling correlation,
and Granger causality testing with objective interpretations.
"""
import os
import json
import numpy as np
import pandas as pd
from scipy import stats
from datetime import datetime
from statsmodels.tsa.stattools import adfuller, grangercausalitytests

from ml_service.config import CROPS, DATASETS_PROCESSED

class StatisticalAnalyzer:
    def __init__(self, data_path=None):
        if data_path is None:
            data_path = DATASETS_PROCESSED / "integrated" / "integrated_price_arrival_dataset.csv"
        self.data_path = data_path
        self.df = pd.read_csv(data_path) if os.path.exists(data_path) else pd.DataFrame()
        
    def _interpret(self, r, p_val, lag, n):
        """Generates clear, farmer-friendly interpretation without assuming or claiming causation."""
        if n < 10 or pd.isna(r):
            return "Insufficient overlapping price and arrival records to establish a reliable relationship."
            
        is_sig = p_val < 0.05
        abs_r = abs(r)
        
        if abs_r < 0.2:
            strength = "negligible to very weak"
        elif abs_r < 0.4:
            strength = "weak"
        elif abs_r < 0.6:
            strength = "moderate"
        elif abs_r < 0.8:
            strength = "strong"
        else:
            strength = "very strong"
            
        direction = "negative (higher arrivals tend to correspond with lower prices)" if r < 0 else "positive (higher arrivals coincide with higher prices, often during peak harvest demand)"
        
        lag_desc = f"at a {lag}-day lag" if lag > 0 else "on the same day"
        sig_desc = "statistically significant (p < 0.05)" if is_sig else "not statistically significant (observed variations may be due to market noise)"
        
        interpretation = (
            f"Over {n} valid observations, arrivals and modal prices show a {strength} {direction} {lag_desc}. "
            f"This relationship is {sig_desc}. Note: Correlation indicates historical association, not real-world causation."
        )
        return interpretation

    def analyze_crop_market(self, crop_id, market_name=None):
        """Analyzes price-arrival dynamics for a specific crop and market (or district aggregate)."""
        sub = self.df[self.df["crop_id"] == crop_id].copy()
        if market_name:
            sub = sub[sub["canonical_market_name"] == market_name]
            
        # Ensure chronological order and valid date index
        sub["observation_date"] = pd.to_datetime(sub["observation_date"])
        sub = sub.sort_values("observation_date").drop_duplicates(subset=["observation_date"]).reset_index(drop=True)
        
        # Valid pairs where both price and arrival are reported
        valid_pairs = sub.dropna(subset=["modal_price", "arrival_quantity"]).copy()
        valid_pairs = valid_pairs[valid_pairs["arrival_quantity"] > 0]
        n_pairs = len(valid_pairs)
        
        results = {
            "crop_id": crop_id,
            "crop_name": CROPS.get(crop_id, {}).get("canonical_name", crop_id),
            "market_name": market_name or "Warangal District Aggregate",
            "analysis_date": datetime.now().strftime("%Y-%m-%d"),
            "sample_count": n_pairs,
            "pearson": {"correlation": None, "p_value": None},
            "spearman": {"correlation": None, "p_value": None},
            "lagged_correlations": {},
            "rolling_correlations": [],
            "granger_causality": None,
            "interpretation": ""
        }
        
        if n_pairs < 8:
            results["interpretation"] = "Insufficient overlapping price and reported arrival records for this market selection."
            return results
            
        # 1. Pearson Correlation
        p_r, p_p = stats.pearsonr(valid_pairs["arrival_quantity"], valid_pairs["modal_price"])
        results["pearson"] = {
            "correlation": round(float(p_r), 4),
            "p_value": round(float(p_p), 5),
            "is_significant": bool(p_p < 0.05)
        }
        
        # 2. Spearman Rank Correlation
        s_r, s_p = stats.spearmanr(valid_pairs["arrival_quantity"], valid_pairs["modal_price"])
        results["spearman"] = {
            "correlation": round(float(s_r), 4),
            "p_value": round(float(s_p), 5),
            "is_significant": bool(s_p < 0.05)
        }
        
        # 3. Lagged Cross-Correlations (0, 1, 3, 7, 15 days)
        # Create full continuous daily series forward-filling prices up to 3 days to capture weekend gaps
        daily_ts = sub.set_index("observation_date").resample("D").first()
        daily_ts["modal_price"] = daily_ts["modal_price"].ffill(limit=3)
        
        lags = [0, 1, 3, 7, 15]
        best_lag = 0
        max_abs_corr = 0.0
        
        for lag in lags:
            if lag == 0:
                lagged_arr = daily_ts["arrival_quantity"]
            else:
                lagged_arr = daily_ts["arrival_quantity"].shift(lag)
                
            valid_lag = pd.concat([daily_ts["modal_price"], lagged_arr], axis=1).dropna()
            valid_lag = valid_lag[valid_lag["arrival_quantity"] > 0]
            
            if len(valid_lag) >= 8:
                r_lag, p_lag = stats.pearsonr(valid_lag["arrival_quantity"], valid_lag["modal_price"])
                results["lagged_correlations"][f"lag_{lag}_days"] = {
                    "lag_days": lag,
                    "correlation": round(float(r_lag), 4),
                    "p_value": round(float(p_lag), 5),
                    "sample_count": len(valid_lag),
                    "is_significant": bool(p_lag < 0.05)
                }
                if abs(r_lag) > max_abs_corr:
                    max_abs_corr = abs(r_lag)
                    best_lag = lag
            else:
                results["lagged_correlations"][f"lag_{lag}_days"] = {
                    "lag_days": lag,
                    "correlation": None,
                    "p_value": None,
                    "sample_count": len(valid_lag),
                    "is_significant": False
                }
                
        # 4. Rolling Correlation (window = 30 days)
        if len(valid_pairs) >= 20:
            rolling_window = min(30, max(15, len(valid_pairs) // 3))
            rolling_corr = valid_pairs["arrival_quantity"].rolling(rolling_window).corr(valid_pairs["modal_price"])
            rolling_df = pd.DataFrame({
                "date": valid_pairs["observation_date"].dt.strftime("%Y-%m-%d"),
                "rolling_corr": rolling_corr
            }).dropna()
            # Sample up to 30 points for chart serialization
            step = max(1, len(rolling_df) // 30)
            results["rolling_correlations"] = [
                {"date": row["date"], "correlation": round(float(row["rolling_corr"]), 4)}
                for _, row in rolling_df.iloc[::step].iterrows()
            ]
            
        # 5. Granger Causality Test
        # Test stationarity and check whether arrivals help predict prices
        if len(valid_pairs) >= 30:
            try:
                # Fill gaps and check stationarity
                ts_subset = valid_pairs[["arrival_quantity", "modal_price"]].copy()
                # Difference to achieve stationarity
                diff_subset = ts_subset.diff().dropna()
                
                # Check ADF p-values
                adf_arr = adfuller(diff_subset["arrival_quantity"])[1]
                adf_price = adfuller(diff_subset["modal_price"])[1]
                
                if adf_arr < 0.1 and adf_price < 0.1:
                    max_gc_lag = min(5, len(diff_subset) // 8)
                    gc_res = grangercausalitytests(diff_subset[["modal_price", "arrival_quantity"]], maxlag=max_gc_lag, verbose=False)
                    
                    best_p_val = 1.0
                    best_gc_lag = 1
                    for l, vals in gc_res.items():
                        f_p = vals[0]["ssr_ftest"][1]
                        if f_p < best_p_val:
                            best_p_val = f_p
                            best_gc_lag = l
                            
                    results["granger_causality"] = {
                        "tested": True,
                        "optimal_lag": best_gc_lag,
                        "p_value": round(float(best_p_val), 5),
                        "indicates_predictive_value": bool(best_p_val < 0.05),
                        "note": "Statistical Granger predictability indicates temporal precedence in linear forecasting, not physical cause-and-effect."
                    }
            except Exception as e:
                results["granger_causality"] = {"tested": False, "reason": str(e)}
                
        # Generate Farmer-Friendly Interpretation
        best_lag_meta = results["lagged_correlations"].get(f"lag_{best_lag}_days", {})
        corr_val = best_lag_meta.get("correlation", p_r)
        p_val = best_lag_meta.get("p_value", p_p)
        results["selected_lag"] = best_lag
        results["interpretation"] = self._interpret(corr_val, p_val, best_lag, n_pairs)
        
        return results

    def run_all_analyses(self):
        """Runs price-arrival correlation analysis across all 7 crops and primary Warangal markets."""
        print("Running Price-Arrival Correlation & Statistical Analysis...")
        master_results = {}
        flat_records = []
        
        for crop_id in CROPS:
            # District level aggregate
            dist_res = self.analyze_crop_market(crop_id)
            master_results[f"{crop_id}_district"] = dist_res
            
            flat_records.append({
                "crop_id": crop_id,
                "crop_name": dist_res["crop_name"],
                "market_name": "Warangal District Aggregate",
                "analysis_date": dist_res["analysis_date"],
                "sample_count": dist_res["sample_count"],
                "pearson_r": dist_res["pearson"].get("correlation"),
                "pearson_p": dist_res["pearson"].get("p_value"),
                "spearman_rho": dist_res["spearman"].get("correlation"),
                "spearman_p": dist_res["spearman"].get("p_value"),
                "selected_lag_days": dist_res.get("selected_lag", 0),
                "interpretation": dist_res["interpretation"]
            })
            
            # Key Mandis in Warangal
            key_mandis = ["Warangal APMC", "Kesamudram APMC", "Jangaon APMC", "Mahabubabad APMC"]
            for mkt in key_mandis:
                mkt_res = self.analyze_crop_market(crop_id, mkt)
                if mkt_res["sample_count"] >= 5:
                    master_results[f"{crop_id}_{mkt.replace(' ', '_')}"] = mkt_res
                    flat_records.append({
                        "crop_id": crop_id,
                        "crop_name": mkt_res["crop_name"],
                        "market_name": mkt,
                        "analysis_date": mkt_res["analysis_date"],
                        "sample_count": mkt_res["sample_count"],
                        "pearson_r": mkt_res["pearson"].get("correlation"),
                        "pearson_p": mkt_res["pearson"].get("p_value"),
                        "spearman_rho": mkt_res["spearman"].get("correlation"),
                        "spearman_p": mkt_res["spearman"].get("p_value"),
                        "selected_lag_days": mkt_res.get("selected_lag", 0),
                        "interpretation": mkt_res["interpretation"]
                    })
                    
        # Save JSON master results
        out_json = DATASETS_PROCESSED / "integrated" / "correlation_results.json"
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(master_results, f, indent=2, ensure_ascii=False)
        print(f"Saved correlation analysis to {out_json}")
        
        # Save CSV summary table
        df_flat = pd.DataFrame(flat_records)
        out_csv = DATASETS_PROCESSED / "integrated" / "correlation_results.csv"
        df_flat.to_csv(out_csv, index=False)
        print(f"Saved correlation summary table to {out_csv}")
        return master_results

if __name__ == "__main__":
    analyzer = StatisticalAnalyzer()
    analyzer.run_all_analyses()

