"""XGBoost Forecasting Model.
Implements gradient boosting with early stopping, hyperparameter selection,
feature importances, and residual-based prediction intervals.
"""
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
import xgboost as xgb
from ml_service.evaluation.metrics import calculate_metrics
from ml_service.config import ML_ARTIFACTS

class XGBoostForecaster:
    def __init__(self, crop_id, horizon_days=15):
        self.crop_id = crop_id
        self.horizon_days = horizon_days
        self.model = None
        self.feature_names = None
        self.residual_std = 0.0
        self.artifacts_dir = ML_ARTIFACTS / "models"
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        
    def train(self, X_train, y_train, X_val=None, y_val=None):
        self.feature_names = list(X_train.columns)
        
        best_mae = float("inf")
        best_model = None
        best_params = {}
        
        param_candidates = [
            {"n_estimators": 150, "max_depth": 4, "learning_rate": 0.05, "subsample": 0.8},
            {"n_estimators": 250, "max_depth": 5, "learning_rate": 0.03, "subsample": 0.85},
            {"n_estimators": 300, "max_depth": 6, "learning_rate": 0.02, "subsample": 0.9}
        ]
        
        for params in param_candidates:
            model = xgb.XGBRegressor(
                n_estimators=params["n_estimators"],
                max_depth=params["max_depth"],
                learning_rate=params["learning_rate"],
                subsample=params["subsample"],
                random_state=42,
                n_jobs=-1,
                early_stopping_rounds=20 if (X_val is not None and y_val is not None) else None
            )
            
            if X_val is not None and y_val is not None and len(X_val) > 0:
                model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
                preds = model.predict(X_val)
                mae = float(np.mean(np.abs(y_val - preds)))
            else:
                model.fit(X_train, y_train, verbose=False)
                preds = model.predict(X_train)
                mae = float(np.mean(np.abs(y_train - preds)))
                
            if mae < best_mae:
                best_mae = mae
                best_model = model
                best_params = params
                
        self.model = best_model
        self.best_params = best_params
        
        # Estimate validation residuals for uncertainty intervals
        train_preds = self.model.predict(X_train)
        self.residual_std = float(np.std(y_train - train_preds))
        return self.model

    def predict_with_interval(self, X, confidence=0.90):
        preds = self.model.predict(X)
        z = 1.645 if confidence == 0.90 else 1.96
        # Expand interval with longer horizons
        horizon_factor = 1.0 + (self.horizon_days / 60.0)
        std = self.residual_std * horizon_factor
        lower_bound = np.maximum(0, preds - z * std)
        upper_bound = preds + z * std
        return preds, lower_bound, upper_bound

    def get_feature_importances(self, top_n=10):
        if not self.model or not self.feature_names:
            return {}
        importances = self.model.feature_importances_
        sorted_indices = np.argsort(importances)[::-1]
        top = {self.feature_names[i]: round(float(importances[i]), 4) for i in sorted_indices[:top_n]}
        return top

    def save(self, filepath=None):
        if filepath is None:
            filepath = self.artifacts_dir / f"xgb_{self.crop_id}_{self.horizon_days}d.joblib"
        joblib.dump({
            "model": self.model,
            "features": self.feature_names,
            "params": self.best_params,
            "residual_std": self.residual_std
        }, filepath)
        return filepath

    def load(self, filepath=None):
        if filepath is None:
            filepath = self.artifacts_dir / f"xgb_{self.crop_id}_{self.horizon_days}d.joblib"
            if not filepath.exists():
                filepath = self.artifacts_dir / f"xgb_{self.crop_id}_15d.joblib"
        data = joblib.load(filepath)
        self.model = data["model"]
        self.feature_names = data["features"]
        self.best_params = data.get("params", {})
        self.residual_std = data.get("residual_std", 120.0)
        return self

