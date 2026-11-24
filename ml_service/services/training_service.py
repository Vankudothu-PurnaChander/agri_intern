"""Training and Model Evaluation Orchestration Service.
Orchestrates chronological training, baseline benchmarks, traditional ML (RF, XGBoost),
deep learning (CNN-BiLSTM-Attention), and selects the best model per crop.
"""
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime

from ml_service.config import CROPS, ML_ARTIFACTS
from ml_service.features.feature_engineering import FeatureEngineer
from ml_service.evaluation.metrics import calculate_metrics
from ml_service.models.baseline import BaselineForecaster
from ml_service.models.random_forest import RandomForestForecaster
from ml_service.models.xgboost_model import XGBoostForecaster
from ml_service.models.cnn_bilstm_attention import DeepLearningForecaster

class TrainingService:
    def __init__(self, horizon_days=15):
        self.horizon_days = horizon_days
        self.fe = FeatureEngineer()
        self.baseline = BaselineForecaster()
        self.artifacts_dir = ML_ARTIFACTS
        self.eval_dir = ML_ARTIFACTS / "evaluation"
        self.eval_dir.mkdir(parents=True, exist_ok=True)
        
    def train_and_evaluate_crop(self, crop_id, market_name=None, run_dl=True):
        """Executes full evaluation lifecycle for a specific crop and market."""
        print(f"\n==================================================")
        print(f"Training & Evaluating Models for Crop: {crop_id.upper()} (Horizon: {self.horizon_days}d)")
        print(f"==================================================")
        
        df_feat = self.fe.build_features_for_crop(crop_id, market_name=market_name, horizon_days=self.horizon_days)
        if df_feat.empty or len(df_feat) < 60:
            print(f"Warning: Insufficient data for {crop_id} ({len(df_feat)} records). Skipping training.")
            return None
            
        feature_cols = [c for c in df_feat.columns if not c.startswith("target") and c not in [
            "observation_date", "crop_id", "market_name"
        ]]
        
        # Chronological Train (70%), Validation (15%), Test (15%)
        clean_df = df_feat.dropna(subset=["target"] + feature_cols).reset_index(drop=True)
        n = len(clean_df)
        train_end = int(n * 0.70)
        val_end = int(n * 0.85)
        
        train_df = clean_df.iloc[:train_end]
        val_df = clean_df.iloc[train_end:val_end]
        test_df = clean_df.iloc[val_end:]
        
        print(f"Chronological Split: Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)}")
        
        X_tr, y_tr = train_df[feature_cols], train_df["target"]
        X_val, y_val = val_df[feature_cols], val_df["target"]
        X_te, y_te = test_df[feature_cols], test_df["target"]
        
        crop_results = {
            "crop_id": crop_id,
            "crop_name": CROPS[crop_id]["canonical_name"],
            "horizon_days": self.horizon_days,
            "training_date": datetime.now().strftime("%Y-%m-%d"),
            "data_range": {"min": clean_df["observation_date"].min(), "max": clean_df["observation_date"].max()},
            "models": {},
            "best_model_name": None
        }
        
        # -------------------------------------------------------------
        # 1. Baseline Models
        # -------------------------------------------------------------
        print("Evaluating Baseline Models...")
        m_last, p_last = self.baseline.evaluate_last_observed(test_df, horizon_days=self.horizon_days)
        m_ma, p_ma = self.baseline.evaluate_moving_average(test_df, window=7, horizon_days=self.horizon_days)
        m_snaive, p_snaive = self.baseline.evaluate_seasonal_naive(test_df, horizon_days=self.horizon_days)
        
        crop_results["models"]["last_observed"] = m_last
        crop_results["models"]["moving_average_7d"] = m_ma
        crop_results["models"]["seasonal_naive"] = m_snaive
        
        # -------------------------------------------------------------
        # 2. Random Forest Regressor
        # -------------------------------------------------------------
        print("Training Random Forest Regressor...")
        rf_forecaster = RandomForestForecaster(crop_id, horizon_days=self.horizon_days)
        rf_forecaster.train(X_tr, y_tr, X_val, y_val)
        
        val_preds_rf = rf_forecaster.model.predict(X_val)
        test_preds_rf, lb_rf, ub_rf = rf_forecaster.predict_with_interval(X_te)
        
        rf_metrics = calculate_metrics(y_te.values, test_preds_rf, y_base=test_df["price_lag_1"].values)
        rf_metrics["val_mae"] = round(float(np.mean(np.abs(y_val.values - val_preds_rf))), 2)
        rf_metrics["model_name"] = "Random Forest Regressor"
        rf_metrics["top_features"] = rf_forecaster.get_feature_importances(top_n=5)
        rf_forecaster.save()
        crop_results["models"]["random_forest"] = rf_metrics
        
        # -------------------------------------------------------------
        # 3. XGBoost Regressor
        # -------------------------------------------------------------
        print("Training XGBoost Regressor...")
        xgb_forecaster = XGBoostForecaster(crop_id, horizon_days=self.horizon_days)
        xgb_forecaster.train(X_tr, y_tr, X_val, y_val)
        
        val_preds_xgb = xgb_forecaster.model.predict(X_val)
        test_preds_xgb, lb_xgb, ub_xgb = xgb_forecaster.predict_with_interval(X_te)
        
        xgb_metrics = calculate_metrics(y_te.values, test_preds_xgb, y_base=test_df["price_lag_1"].values)
        xgb_metrics["val_mae"] = round(float(np.mean(np.abs(y_val.values - val_preds_xgb))), 2)
        xgb_metrics["model_name"] = "XGBoost Regressor"
        xgb_metrics["top_features"] = xgb_forecaster.get_feature_importances(top_n=5)
        xgb_forecaster.save()
        crop_results["models"]["xgboost"] = xgb_metrics
        
        # -------------------------------------------------------------
        # 4. CNN-BiLSTM-Attention Deep Learning Model
        # -------------------------------------------------------------
        if run_dl and len(train_df) >= 100:
            print("Training CNN-BiLSTM-Attention Deep Learning Model...")
            try:
                dl_forecaster = DeepLearningForecaster(crop_id, horizon_days=self.horizon_days, window_size=30)
                dl_forecaster.train(X_tr, y_tr, X_val, y_val, epochs=35, batch_size=32)
                
                # Sequence evaluation on test set
                X_te_s = dl_forecaster.scaler_x.transform(X_te)
                y_te_s = dl_forecaster.scaler_y.transform(y_te.values.reshape(-1, 1)).flatten()
                seq_te, tar_te = dl_forecaster.create_sequences(X_te_s, y_te_s)
                
                if len(seq_te) > 0:
                    preds_dl = dl_forecaster.predict(seq_te)
                    actual_dl = dl_forecaster.scaler_y.inverse_transform(tar_te.reshape(-1, 1)).flatten()
                    base_dl = test_df["price_lag_1"].iloc[30:].values[:len(actual_dl)]
                    
                    dl_metrics = calculate_metrics(actual_dl, preds_dl, y_base=base_dl)
                    dl_metrics["model_name"] = "CNN-BiLSTM-Attention"
                    dl_forecaster.save()
                    crop_results["models"]["cnn_bilstm_attention"] = dl_metrics
            except Exception as e:
                print(f"Deep learning training notice for {crop_id}: {e}")
                crop_results["models"]["cnn_bilstm_attention"] = {"error": str(e), "model_name": "CNN-BiLSTM-Attention"}
                
        # -------------------------------------------------------------
        # 5. Model Selection & Outperformance Validation Gate
        # -------------------------------------------------------------
        candidates = ["random_forest", "xgboost"]
        if "cnn_bilstm_attention" in crop_results["models"] and "mae" in crop_results["models"]["cnn_bilstm_attention"] and crop_results["models"]["cnn_bilstm_attention"]["mae"] is not None:
            candidates.append("cnn_bilstm_attention")
            
        best_cand = min(candidates, key=lambda c: crop_results["models"][c].get("mae", float("inf")) or float("inf"))
        
        # Benchmark check against Seasonal Naive baseline
        snaive_mae = crop_results["models"].get("seasonal_naive", {}).get("mae")
        best_mae = crop_results["models"][best_cand].get("mae")
        if snaive_mae and best_mae and snaive_mae < best_mae:
            print(f"   Notice: Seasonal Naive baseline achieved lower MAE (Rs.{snaive_mae}) than {best_cand} (Rs.{best_mae}). Flagging baseline competitive performance.")
            crop_results["baseline_outperformed"] = False
        else:
            crop_results["baseline_outperformed"] = True

        crop_results["best_model_name"] = best_cand
        crop_results["selected_model_metrics"] = crop_results["models"][best_cand]
        
        print(f"--> BEST MODEL SELECTED FOR {crop_id.upper()} ({self.horizon_days}d): {best_cand.upper()} (Test MAE: Rs.{crop_results['models'][best_cand].get('mae')}/Qtl)")
        return crop_results

    def train_all_horizons(self, horizons=(7, 15, 30), run_dl=True):
        """Trains models across all 7 supported crops in Warangal for multiple horizons (7, 15, 30 days)."""
        all_evaluations = {}
        all_comparison_rows = []
        
        for h in horizons:
            self.horizon_days = h
            print(f"\n#######################################################")
            print(f"### TRAINING HORIZON: {h} DAYS                      ###")
            print(f"#######################################################")
            for crop_id in CROPS:
                res = self.train_and_evaluate_crop(crop_id, run_dl=(run_dl and h == 15))
                if res:
                    key = f"{crop_id}_{h}d"
                    all_evaluations[key] = res
                    # Maintain primary crop_id pointer in master evaluation (15d default or first available)
                    if h == 15 or crop_id not in all_evaluations:
                        all_evaluations[crop_id] = res
                    for m_key, m_metrics in res["models"].items():
                        if isinstance(m_metrics, dict) and "mae" in m_metrics:
                            all_comparison_rows.append({
                                "Crop": res["crop_name"],
                                "Crop_ID": crop_id,
                                "Horizon_Days": h,
                                "Model": m_metrics.get("model_name", m_key),
                                "MAE (₹/Qtl)": m_metrics.get("mae"),
                                "RMSE (₹/Qtl)": m_metrics.get("rmse"),
                                "MAPE (%)": m_metrics.get("mape"),
                                "sMAPE (%)": m_metrics.get("smape"),
                                "R²": m_metrics.get("r2"),
                                "Directional Accuracy (%)": m_metrics.get("directional_accuracy"),
                                "Is_Selected_Best": (m_key == res["best_model_name"])
                            })
                            
        # Save JSON master evaluation
        out_json = self.eval_dir / "model_comparison.json"
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(all_evaluations, f, indent=2, ensure_ascii=False)
        print(f"\nSaved master model evaluation comparison JSON to {out_json}")
        
        # Save CSV comparison table
        df_comp = pd.DataFrame(all_comparison_rows)
        out_csv = self.eval_dir / "model_comparison.csv"
        df_comp.to_csv(out_csv, index=False)
        print(f"Saved master model comparison table CSV to {out_csv}")
        return all_evaluations

    def train_all_crops(self):
        """Trains models across all 7 supported crops and all 3 required horizons (7, 15, 30 days)."""
        return self.train_all_horizons(horizons=(7, 15, 30))

if __name__ == "__main__":
    ts = TrainingService(horizon_days=15)
    ts.train_all_crops()
