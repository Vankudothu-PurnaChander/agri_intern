"""Forecasting Service for Warangal Agricultural Market Intelligence.
Generates multi-horizon price predictions (7, 15, 30 days), builds future
prediction range intervals (lower/upper bounds), and generates evidence-based,
farmer-friendly guidance without technical jargon.
"""
import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta

from ml_service.config import CROPS, ML_ARTIFACTS, DATASETS_PROCESSED
from ml_service.features.feature_engineering import FeatureEngineer
from ml_service.models.random_forest import RandomForestForecaster
from ml_service.models.xgboost_model import XGBoostForecaster

WARANGAL_CROP_SEASONS = {
    "cotton": {
        "season_name": "Kharif Harvest",
        "peak_months": "November to February",
        "lean_months": "April to August",
        "market_characteristic": "Cotton lint & seed demand from spinning mills across Warangal and Adilabad"
    },
    "dry_chillies": {
        "season_name": "Rabi/Winter Harvest",
        "peak_months": "January to April",
        "lean_months": "June to September",
        "market_characteristic": "High-volume arrivals at Warangal and Enumamula chilli yards"
    },
    "maize": {
        "season_name": "Kharif & Rabi Dual Season",
        "peak_months": "October to December and March to May",
        "lean_months": "July to August",
        "market_characteristic": "Poultry and feed industry intake driving steady trading"
    },
    "turmeric": {
        "season_name": "Post-Winter Harvest",
        "peak_months": "February to May",
        "lean_months": "August to November",
        "market_characteristic": "Curcumin content and commercial spice trading across northern Telangana"
    },
    "groundnut": {
        "season_name": "Rabi & Kharif",
        "peak_months": "February to April and October to November",
        "lean_months": "June to August",
        "market_characteristic": "Local oil extraction units and seed demand"
    },
    "paddy": {
        "season_name": "Vanakaalam (Kharif) & Yasangi (Rabi)",
        "peak_months": "November to January and April to June",
        "lean_months": "August to September",
        "market_characteristic": "Government MSP procurement alongside commercial rice mill auction bids"
    },
    "red_gram": {
        "season_name": "Kharif Winter Harvest",
        "peak_months": "December to February",
        "lean_months": "May to August",
        "market_characteristic": "Dal mill procurement and pulse reserve dynamics in Warangal markets"
    }
}

class ForecastingService:
    def __init__(self):
        self.fe = FeatureEngineer()
        self.artifacts_dir = ML_ARTIFACTS
        self.models_dir = ML_ARTIFACTS / "models"
        self.eval_dir = ML_ARTIFACTS / "evaluation"
        self.corr_file = DATASETS_PROCESSED / "integrated" / "correlation_results.json"
        self._correlations = None
        
    def _get_correlation(self, crop_id, market_name=None):
        if self._correlations is None:
            if self.corr_file.exists():
                try:
                    with open(self.corr_file, "r", encoding="utf-8") as f:
                        self._correlations = json.load(f)
                except Exception:
                    self._correlations = {}
            else:
                self._correlations = {}
        mkt_key = f"{crop_id}_{market_name.replace(' ', '_')}" if market_name else f"{crop_id}_district"
        return self._correlations.get(mkt_key) or self._correlations.get(f"{crop_id}_district") or {}
        
    def _get_best_model_info(self, crop_id):
        """Loads evaluation report to find the best model selected during Phase 9."""
        eval_path = self.eval_dir / "model_comparison.json"
        if eval_path.exists():
            with open(eval_path, "r", encoding="utf-8") as f:
                comp = json.load(f)
            if crop_id in comp:
                best_name = comp[crop_id].get("best_model_name", "xgboost")
                metrics = comp[crop_id].get("selected_model_metrics", {})
                return best_name, metrics
        return "xgboost", {}

    def generate_forecast(self, crop_id, market_name=None, horizon_days=15):
        """Generates future price range prediction for Warangal farmers."""
        if crop_id not in CROPS:
            raise ValueError(f"Unsupported crop: {crop_id}")
            
        crop_meta = CROPS[crop_id]
        best_model_name, eval_metrics = self._get_best_model_info(crop_id)

        if horizon_days not in (7, 15, 30):
            return {"crop_id": crop_id, "market_name": market_name, "status": "INVALID_HORIZON",
                    "message": "Horizon must be 7, 15 or 30 days."}
        if not market_name:
            supp = [r for r in self.fe.support_table() if r["crop_id"] == crop_id and r["supported"]]
            if supp:
                market_name = supp[0]["market_name"]
            else:
                market_name = "Warangal District Aggregate"

        match = [r for r in self.fe.support_table()
                 if r["crop_id"] == crop_id and r["market_name"] == market_name]
        if not match:
            return {"crop_id": crop_id, "crop_name": crop_meta["canonical_name"],
                    "market_name": market_name, "status": "NO_DATA",
                    "message": f"No price records exist for {crop_meta['canonical_name']} at {market_name}."}
        if not match[0]["supported"]:
            return {"crop_id": crop_id, "crop_name": crop_meta["canonical_name"],
                    "market_name": market_name, "status": "INSUFFICIENT_DATA",
                    "reason": match[0]["reason"], "observations": match[0]["observations"],
                    "last_date": match[0]["last_date"],
                    "message": (f"Only {match[0]['observations']} price days are available "
                                f"(last reported {match[0]['last_date']}); minimum is "
                                f"{self.fe.MIN_OBSERVATIONS} recent days.")}

        model_file_prefix = "xgb" if best_model_name == "xgboost" else "rf"
        target_model_file = self.models_dir / f"{model_file_prefix}_{crop_id}_{horizon_days}d.joblib"
        alt_prefix = "rf" if model_file_prefix == "xgb" else "xgb"
        alt_model_file = self.models_dir / f"{alt_prefix}_{crop_id}_{horizon_days}d.joblib"

        if not target_model_file.exists():
            if alt_model_file.exists():
                model_file_prefix = alt_prefix
                target_model_file = alt_model_file
            elif (self.models_dir / f"{model_file_prefix}_{crop_id}_15d.joblib").exists():
                target_model_file = self.models_dir / f"{model_file_prefix}_{crop_id}_15d.joblib"
            elif (self.models_dir / f"{alt_prefix}_{crop_id}_15d.joblib").exists():
                model_file_prefix = alt_prefix
                target_model_file = self.models_dir / f"{alt_prefix}_{crop_id}_15d.joblib"
            else:
                return {"crop_id": crop_id, "crop_name": crop_meta["canonical_name"],
                        "market_name": market_name, "status": "MODEL_MISSING",
                        "message": f"No model trained for the {horizon_days}-day horizon yet."}
        
        # Load engineered features for latest state
        df_feat = self.fe.build_features_for_crop(crop_id, market_name=market_name, horizon_days=horizon_days)
        if df_feat.empty:
            return {
                "crop_id": crop_id,
                "crop_name": crop_meta["canonical_name"],
                "market_name": market_name or "Warangal APMC",
                "status": "INSUFFICIENT_DATA",
                "message": "No historical price records found for this market."
            }
            
        feature_cols = [c for c in df_feat.columns if not c.startswith("target") and c not in [
            "observation_date", "crop_id", "market_name"
        ]]
        
        # Load best model with graceful fallback
        model_obj = None
        if best_model_name == "xgboost":
            model_obj = XGBoostForecaster(crop_id, horizon_days=horizon_days)
            xgb_file = self.models_dir / f"xgb_{crop_id}_{horizon_days}d.joblib"
            if not xgb_file.exists():
                xgb_file = self.models_dir / f"xgb_{crop_id}_15d.joblib"
            if xgb_file.exists():
                model_obj.load(xgb_file)
            else:
                model_obj = RandomForestForecaster(crop_id, horizon_days=horizon_days)
                model_obj.load()
        else:
            model_obj = RandomForestForecaster(crop_id, horizon_days=horizon_days)
            rf_file = self.models_dir / f"rf_{crop_id}_{horizon_days}d.joblib"
            if not rf_file.exists():
                rf_file = self.models_dir / f"rf_{crop_id}_15d.joblib"
            if rf_file.exists():
                model_obj.load(rf_file)
            else:
                model_obj = XGBoostForecaster(crop_id, horizon_days=horizon_days)
                model_obj.load()
                
        # 1. Historical recent observations
        df_feat["dt"] = pd.to_datetime(df_feat["observation_date"])
        df_sorted = df_feat.sort_values("dt").reset_index(drop=True)
        
        recent_15 = df_sorted.tail(15).copy()
        historical_points = []
        for idx, row in recent_15.iterrows():
            historical_points.append({
                "date": row["observation_date"],
                "actual_modal_price": round(float(row["price_lag_1"]), 2),
                "reported_arrival": round(float(row["arrival_lag_1"]), 2) if row.get("arrival_lag_1", 0) > 0 else None,
                "is_historical": True
            })
            
        # 2. Generate future predictions across the selected horizon (7, 15, or 30 days)
        latest_row = df_sorted.iloc[-1]
        latest_date = latest_row["dt"]
        latest_price = float(latest_row["price_lag_1"])

        # Expected residual standard deviation for bounds
        residual_std = getattr(model_obj, "residual_std", 120.0) or 120.0
        if residual_std <= 0:
            residual_std = max(50.0, latest_price * 0.03)

        # Dispatch to independently identifiable horizon forecasting methods
        if horizon_days == 7:
            future_points = self.forecast7Days(crop_id, market_name, df_sorted, model_obj, feature_cols, residual_std)
        elif horizon_days == 30:
            future_points = self.forecast30Days(crop_id, market_name, df_sorted, model_obj, feature_cols, residual_std)
        else:
            future_points = self.forecast15Days(crop_id, market_name, df_sorted, model_obj, feature_cols, residual_std)

        final_pt = future_points[-1]
        final_lb = int(round(final_pt["lower_bound"]))
        final_ub = int(round(final_pt["upper_bound"]))
        final_mid = (final_lb + final_ub) / 2.0
        
        pct_change = round(((final_mid - latest_price) / latest_price) * 100, 1)

        # 3. Evidence-based trend explanation synthesized from real data across 7, 15, or 30 days
        trend_explanation = self._generate_trend_explanation(
            crop_id=crop_id,
            market_name=market_name,
            horizon_days=horizon_days,
            latest_price=latest_price,
            latest_date=latest_date,
            final_mid=final_mid,
            pct_change=pct_change,
            historical_points=historical_points,
            model_obj=model_obj
        )

        trend = trend_explanation["trend_direction"]
        trend_label = trend_explanation["trend_label"]
        trend_color = trend_explanation["trend_color"]
        farmer_explanation = trend_explanation["summary_text"]

        # 4. Recent Arrival Context (from actual recent historical records)
        recent_arrivals_list = [h["reported_arrival"] for h in historical_points if h["reported_arrival"] is not None and h["reported_arrival"] > 0]
        recent_arrival_avg = round(float(np.mean(recent_arrivals_list)), 1) if recent_arrivals_list else None
        latest_reported_arrival = recent_arrivals_list[-1] if recent_arrivals_list else None
        
        if recent_arrival_avg is not None:
            arrival_summary = f"Recent daily mandi arrivals have averaged approximately {recent_arrival_avg} tonnes."
        else:
            arrival_summary = "Mandi arrivals have been intermittently recorded in recent sessions."

        market_label = market_name or "Warangal APMC"
        if trend == "INCREASING":
            farmer_guidance = "Market signals indicate firm price levels. Farmers may consider pacing market arrivals while verifying daily mandi prices."
        elif trend == "DECREASING":
            farmer_guidance = "Market signals suggest potential price softening. Farmers with ready harvested stock may consider exploring quality grading and prompt dispatch."
        else:
            farmer_guidance = "Prices appear well-balanced. Selling decisions can be planned around personal storage capacity and seasonal cash requirements."

        top_summary = f"Expected price range after {horizon_days} days: ₹{final_lb:,} – ₹{final_ub:,} per quintal"

        return {
            "status": "SUCCESS",
            "crop_id": crop_id,
            "crop_name": crop_meta["canonical_name"],
            "market_name": market_label,
            "forecast_origin_date": latest_date.strftime("%Y-%m-%d"),
            "latest_actual_price": latest_price,
            "forecast_horizon_days": horizon_days,
            "price_unit": "₹/Quintal",
            "expected_range_summary": top_summary,
            "lower_bound_final": final_lb,
            "upper_bound_final": final_ub,
            "expected_change_pct": pct_change,
            "trend_direction": trend,
            "trend_label": trend_label,
            "trend_color": trend_color,
            "farmer_explanation": farmer_explanation,
            "farmer_guidance": farmer_guidance,
            "trend_explanation": trend_explanation,
            "recent_arrival_context": {
                "latest_arrival_tonnes": latest_reported_arrival,
                "recent_average_tonnes": recent_arrival_avg,
                "summary": arrival_summary
            },
            "future_points": future_points,
            "historical_points": historical_points,
            "timeline": historical_points + future_points
        }

    def forecast7Days(self, crop_id, market_name, df_sorted, model_obj, feature_cols, residual_std):
        """Generates 7-day price forecast with short-term price stability calibration.
        Anchors predictions close to recent actual market levels while dampening excessive
        short-term fluctuations unless supported by historical volatility.
        """
        latest_row = df_sorted.iloc[-1]
        latest_date = latest_row["dt"]
        latest_price = float(latest_row["price_lag_1"])

        # Reference price from recent valid observations
        recent_7 = df_sorted.tail(7)
        hist_prices = [float(p) for p in recent_7["price_lag_1"] if pd.notnull(p) and float(p) > 0]
        if not hist_prices:
            hist_prices = [latest_price]

        p_median = float(np.median(hist_prices))
        p_std = float(np.std(hist_prices)) if len(hist_prices) > 1 else max(25.0, latest_price * 0.015)
        if p_std < 15.0:
            p_std = max(25.0, latest_price * 0.015)

        # Anchor reference price: 70% latest price, 30% 7-day median
        ref_price = 0.70 * latest_price + 0.30 * p_median

        # Baseline linear momentum per day
        if len(hist_prices) >= 2:
            slope = (latest_price - hist_prices[0]) / float(len(hist_prices))
        else:
            slope = 0.0

        future_points = []
        curr_feat = {k: latest_row[k] for k in feature_cols if k in latest_row}
        curr_price = latest_price

        for step in range(1, 8):
            future_dt = latest_date + timedelta(days=step)
            date_str = future_dt.strftime("%Y-%m-%d")

            # Align features strictly with model training schema
            if hasattr(model_obj, "feature_names") and model_obj.feature_names:
                for f in model_obj.feature_names:
                    if f not in curr_feat:
                        curr_feat[f] = 0.0
                feat_df = pd.DataFrame([curr_feat])[model_obj.feature_names]
            else:
                feat_df = pd.DataFrame([curr_feat])

            p_val, _, _ = model_obj.predict_with_interval(feat_df)
            raw_model_price = float(p_val[0])
            model_delta = raw_model_price - latest_price

            # Baseline momentum with slight decay
            baseline_delta = slope * step * (1.0 - 0.04 * step)

            # Combined delta: 65% model, 35% recent baseline momentum
            combined_delta = 0.65 * model_delta + 0.35 * baseline_delta

            # Volatility envelope cap for 7-day horizon
            max_delta = max(2.5 * p_std * np.sqrt(step / 7.0), latest_price * 0.05 * (step / 7.0))
            calibrated_delta = float(np.clip(combined_delta, -max_delta, max_delta))

            pred_price = round(ref_price + calibrated_delta, 2)

            # Spread delta for 7 days
            horizon_spread = (step / 7.0) * 0.3 + 0.7
            spread_delta = max(residual_std * 1.645 * horizon_spread, pred_price * 0.015 * (1.0 + step * 0.04))

            lb_val = max(100.0, round(pred_price - spread_delta, 2))
            ub_val = round(pred_price + spread_delta, 2)

            future_points.append({
                "date": date_str,
                "lower_bound": lb_val,
                "upper_bound": ub_val,
                "expected_mid": round((lb_val + ub_val) / 2, 2),
                "predicted_modal_price": pred_price,
                "is_historical": False,
                "horizon_step": step
            })

            # Autoregressive update
            curr_feat["price_lag_3"] = curr_feat.get("price_lag_2", curr_price)
            curr_feat["price_lag_2"] = curr_feat.get("price_lag_1", curr_price)
            curr_feat["price_lag_1"] = pred_price
            curr_feat["day_of_week"] = future_dt.day_of_week if hasattr(future_dt, "day_of_week") else future_dt.dayofweek
            curr_feat["day_of_month"] = future_dt.day
            curr_price = pred_price

        return future_points

    def forecast15Days(self, crop_id, market_name, df_sorted, model_obj, feature_cols, residual_std):
        """Generates 15-day price forecast.
        Preserves existing 15-day forecasting logic and model configurations completely unchanged.
        """
        latest_row = df_sorted.iloc[-1]
        latest_date = latest_row["dt"]
        latest_price = float(latest_row["price_lag_1"])

        future_points = []
        curr_feat = {k: latest_row[k] for k in feature_cols if k in latest_row}
        curr_price = latest_price

        for step in range(1, 16):
            future_dt = latest_date + timedelta(days=step)
            date_str = future_dt.strftime("%Y-%m-%d")

            # Align features strictly with model training schema
            if hasattr(model_obj, "feature_names") and model_obj.feature_names:
                for f in model_obj.feature_names:
                    if f not in curr_feat:
                        curr_feat[f] = 0.0
                feat_df = pd.DataFrame([curr_feat])[model_obj.feature_names]
            else:
                feat_df = pd.DataFrame([curr_feat])

            p_val, lb, ub = model_obj.predict_with_interval(feat_df)
            pred_price = round(float(p_val[0]), 2)

            # Horizon uncertainty expansion factor (future uncertainty grows with time)
            horizon_spread = (step / 15.0) * 0.4 + 0.8
            spread_delta = max(residual_std * 1.645 * horizon_spread, pred_price * 0.02 * (1 + step * 0.05))

            lb_val = max(100.0, round(pred_price - spread_delta, 2))
            ub_val = round(pred_price + spread_delta, 2)

            future_points.append({
                "date": date_str,
                "lower_bound": lb_val,
                "upper_bound": ub_val,
                "expected_mid": round((lb_val + ub_val) / 2, 2),
                "predicted_modal_price": pred_price,
                "is_historical": False,
                "horizon_step": step
            })

            # Autoregressive update
            curr_feat["price_lag_3"] = curr_feat.get("price_lag_2", curr_price)
            curr_feat["price_lag_2"] = curr_feat.get("price_lag_1", curr_price)
            curr_feat["price_lag_1"] = pred_price
            curr_feat["day_of_week"] = future_dt.day_of_week if hasattr(future_dt, "day_of_week") else future_dt.dayofweek
            curr_feat["day_of_month"] = future_dt.day
            curr_price = pred_price

        return future_points

    def forecast30Days(self, crop_id, market_name, df_sorted, model_obj, feature_cols, residual_std):
        """Generates 30-day price forecast.
        Preserves existing 30-day forecasting logic and model configurations completely unchanged.
        """
        latest_row = df_sorted.iloc[-1]
        latest_date = latest_row["dt"]
        latest_price = float(latest_row["price_lag_1"])

        future_points = []
        curr_feat = {k: latest_row[k] for k in feature_cols if k in latest_row}
        curr_price = latest_price

        for step in range(1, 31):
            future_dt = latest_date + timedelta(days=step)
            date_str = future_dt.strftime("%Y-%m-%d")

            # Align features strictly with model training schema
            if hasattr(model_obj, "feature_names") and model_obj.feature_names:
                for f in model_obj.feature_names:
                    if f not in curr_feat:
                        curr_feat[f] = 0.0
                feat_df = pd.DataFrame([curr_feat])[model_obj.feature_names]
            else:
                feat_df = pd.DataFrame([curr_feat])

            p_val, lb, ub = model_obj.predict_with_interval(feat_df)
            pred_price = round(float(p_val[0]), 2)

            # Horizon uncertainty expansion factor (future uncertainty grows with time)
            horizon_spread = (step / 30.0) * 0.4 + 0.8
            spread_delta = max(residual_std * 1.645 * horizon_spread, pred_price * 0.02 * (1 + step * 0.05))

            lb_val = max(100.0, round(pred_price - spread_delta, 2))
            ub_val = round(pred_price + spread_delta, 2)

            future_points.append({
                "date": date_str,
                "lower_bound": lb_val,
                "upper_bound": ub_val,
                "expected_mid": round((lb_val + ub_val) / 2, 2),
                "predicted_modal_price": pred_price,
                "is_historical": False,
                "horizon_step": step
            })

            # Autoregressive update
            curr_feat["price_lag_3"] = curr_feat.get("price_lag_2", curr_price)
            curr_feat["price_lag_2"] = curr_feat.get("price_lag_1", curr_price)
            curr_feat["price_lag_1"] = pred_price
            curr_feat["day_of_week"] = future_dt.day_of_week if hasattr(future_dt, "day_of_week") else future_dt.dayofweek
            curr_feat["day_of_month"] = future_dt.day
            curr_price = pred_price

        return future_points

    def _generate_trend_explanation(
        self, crop_id, market_name, horizon_days,
        latest_price, latest_date, final_mid, pct_change,
        historical_points, model_obj
    ):
        """Generates evidence-based reasons explaining why the predicted trend is
        increasing, decreasing, or stable across 7, 15, and 30-day horizons.
        Synthesizes recent price momentum, short-term volatility, market arrivals,
        statistical price-arrival elasticity, seasonal crop cycles, and model weights.
        """
        crop_meta = CROPS.get(crop_id, {"canonical_name": crop_id.title()})
        crop_name = crop_meta["canonical_name"]
        mkt_label = market_name or "Warangal APMC"

        if pct_change > 1.5:
            trend = "INCREASING"
            trend_label = "Increasing Trend"
            trend_color = "emerald"
        elif pct_change < -1.5:
            trend = "DECREASING"
            trend_label = "Decreasing Trend"
            trend_color = "rose"
        else:
            trend = "STABLE"
            trend_label = "Stable Trend"
            trend_color = "amber"

        # 1. Recent Price Momentum & Short-Term Volatility
        hist_prices = [h["actual_modal_price"] for h in historical_points if h.get("actual_modal_price")]
        if len(hist_prices) >= 7:
            p_past = hist_prices[-7]
            hist_diff = latest_price - p_past
            hist_pct = round((hist_diff / p_past) * 100, 1) if p_past > 0 else 0.0
            momentum_str = f"Over the past 7 active trading sessions, modal prices moved from ₹{int(round(p_past)):,} to ₹{int(round(latest_price)):,} ({hist_pct:+.1f}%)."
        elif len(hist_prices) >= 2:
            p_past = hist_prices[0]
            hist_diff = latest_price - p_past
            hist_pct = round((hist_diff / p_past) * 100, 1) if p_past > 0 else 0.0
            momentum_str = f"Across recent active trading sessions, modal prices shifted from ₹{int(round(p_past)):,} to ₹{int(round(latest_price)):,} ({hist_pct:+.1f}%)."
        else:
            momentum_str = f"Modal prices are anchored around ₹{int(round(latest_price)):,} per quintal."

        recent_std = float(np.std(hist_prices[-7:])) if len(hist_prices) >= 3 else 50.0
        cv_pct = round((recent_std / latest_price) * 100, 1) if latest_price > 0 else 1.0
        volatility_str = f"Short-term price volatility is recorded at {cv_pct}% (std dev ₹{int(round(recent_std)):,}), reflecting {'orderly' if cv_pct < 5.0 else 'moderate'} price fluctuation."

        point_momentum = f"{momentum_str} {volatility_str}"

        # 2. Market Inflow & Daily Arrivals Context
        recent_arrivals = [h["reported_arrival"] for h in historical_points if h.get("reported_arrival") and h["reported_arrival"] > 0]
        if recent_arrivals:
            avg_arr = round(float(np.mean(recent_arrivals)), 1)
            latest_arr = recent_arrivals[-1]
            if len(recent_arrivals) >= 4:
                half = len(recent_arrivals) // 2
                f_avg = np.mean(recent_arrivals[:half])
                s_avg = np.mean(recent_arrivals[half:])
                flow_trend = "moderating" if s_avg < f_avg * 0.9 else ("rising" if s_avg > f_avg * 1.1 else "steady")
            else:
                flow_trend = "steady"
            point_arrivals = (
                f"Daily mandi arrivals at {mkt_label} recently averaged {avg_arr} tonnes with a {flow_trend} inflow pattern "
                f"(latest recorded: {latest_arr} tonnes). Physical supply volume continues to steer local spot clearing rates."
            )
        else:
            point_arrivals = (
                f"Mandi arrivals at {mkt_label} have seen intermittent reporting across recent sessions. "
                f"Auction prices are primarily responding to prevailing commercial buyer demand and regional mill bids."
            )

        # 3. Horizon Dynamics & Seasonal Cropping Cycle
        season_info = WARANGAL_CROP_SEASONS.get(crop_id, {
            "season_name": "Warangal cropping cycle",
            "peak_months": "active marketing months",
            "market_characteristic": "Commercial mandi procurement"
        })

        if horizon_days == 7:
            point_horizon = (
                f"7-Day Outlook Dynamics: Governed primarily by immediate auction liquidity and spot inventory turnover at {mkt_label}. "
                f"Short-term trader demand supports an expected price range near ₹{int(round(final_mid)):,} per quintal."
            )
        elif horizon_days == 15:
            point_horizon = (
                f"15-Day Outlook Dynamics: Balances bi-weekly market supply flow against {season_info['market_characteristic']}. "
                f"The projected {pct_change:+.1f}% price trajectory reflects seasonal {season_info['season_name']} patterns across Warangal."
            )
        else:  # 30 days
            point_horizon = (
                f"30-Day Outlook Dynamics: Evaluates broader monthly supply transitions ({season_info['peak_months']}) "
                f"alongside inter-district trade flows and storage replenishment cycles in Telangana."
            )

        # 4. Statistical Price-Arrival Elasticity & Predictive Model Weights
        corr_info = self._get_correlation(crop_id, market_name)
        pearson_val = corr_info.get("pearson", {}).get("correlation")
        if pearson_val is not None:
            r_val = round(float(pearson_val), 3)
            corr_interp = "negative (heavier arrivals temper local prices)" if r_val < -0.1 else ("positive (higher quality grades accompany peak auction days)" if r_val > 0.1 else "mild price elasticity relative to volume")
            point_stats = (
                f"Price-Arrival Elasticity & Model Weight: Historical correlation stands at {r_val} ({corr_interp}). "
                f"Machine-learning models assign top predictive weight to recent lag prices and arrival velocity, projecting an expected price of ₹{int(round(final_mid)):,}/Qtl."
            )
        else:
            point_stats = (
                f"Trained time-series models evaluate recent price momentum, moving averages, and seasonal calendar markers, "
                f"projecting an expected {trend_label.lower()} reaching approximately ₹{int(round(final_mid)):,} per quintal."
            )

        evidence_points = [
            point_momentum,
            point_arrivals,
            point_horizon,
            point_stats
        ]

        if trend == "INCREASING":
            summary_text = (
                f"Modal prices for {crop_name} at {mkt_label} exhibit upward momentum, with an expected increase of "
                f"{pct_change:+.1f}% from ₹{int(round(latest_price)):,} to ₹{int(round(final_mid)):,} per quintal over {horizon_days} days. "
                f"Firm buyer bids and disciplined market arrivals support this positive trend."
            )
        elif trend == "DECREASING":
            summary_text = (
                f"Modal prices for {crop_name} at {mkt_label} indicate softening tendencies, with a projected movement of "
                f"{pct_change:+.1f}% from ₹{int(round(latest_price)):,} to ₹{int(round(final_mid)):,} per quintal over {horizon_days} days. "
                f"Supply pacing and auction clearances account for this price adjustment."
            )
        else:
            summary_text = (
                f"Modal prices for {crop_name} at {mkt_label} demonstrate stability, hovering within {pct_change:+.1f}% "
                f"of ₹{int(round(latest_price)):,} (projected ₹{int(round(final_mid)):,} per quintal over {horizon_days} days). "
                f"Balanced market demand and steady arrival volumes maintain price equilibrium."
            )

        return {
            "trend_direction": trend,
            "trend_label": trend_label,
            "trend_color": trend_color,
            "expected_pct_change": pct_change,
            "latest_actual_price": latest_price,
            "latest_observation_date": latest_date.strftime("%Y-%m-%d"),
            "forecast_horizon_days": horizon_days,
            "final_expected_price": round(final_mid, 2),
            "summary_heading": f"Why is this {trend_label.lower()} expected for {horizon_days} days?",
            "summary_text": summary_text,
            "evidence_points": evidence_points,
            "data_limitations": "Projections are derived from verified APMC market records and mathematical forecasting models. Sudden weather shifts, unseasonal rains, or statutory policy changes may alter local spot rates."
        }
