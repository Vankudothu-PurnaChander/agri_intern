"""Random Forest Forecasting Model.
Implements hyperparameter tuning, feature importance extraction,
model serialization, and tree-variance based prediction intervals.
"""
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from ml_service.evaluation.metrics import calculate_metrics
from ml_service.config import ML_ARTIFACTS

class RandomForestForecaster:
    def __init__(self, crop_id, horizon_days=15):
        self.crop_id = crop_id
        self.horizon_days = horizon_days
        self.model = None
        self.feature_names = None
        self.artifacts_dir = ML_ARTIFACTS / "models"
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        
    def train(self, X_train, y_train, X_val=None, y_val=None):
        """Trains RandomForestRegressor with parameter selection on validation set."""
        self.feature_names = list(X_train.columns)
        
        best_mae = float("inf")
        best_rf = None
        best_params = {}
        
        param_grid = [
            {"n_estimators": 100, "max_depth": 8, "min_samples_split": 5},
            {"n_estimators": 150, "max_depth": 12, "min_samples_split": 4},
            {"n_estimators": 200, "max_depth": 16, "min_samples_split": 2}
        ]
        
        for params in param_grid:
            rf = RandomForestRegressor(
                n_estimators=params["n_estimators"],
                max_depth=params["max_depth"],
                min_samples_split=params["min_samples_split"],
                random_state=42,
                n_jobs=-1
            )
            rf.fit(X_train, y_train)
            
            if X_val is not None and y_val is not None and len(X_val) > 0:
                preds = rf.predict(X_val)
                mae = float(np.mean(np.abs(y_val - preds)))
            else:
                mae = float(np.mean(np.abs(y_train - rf.predict(X_train))))
                
            if mae < best_mae:
                best_mae = mae
                best_rf = rf
                best_params = params
                
        self.model = best_rf
        self.best_params = best_params
        return self.model

    def predict_with_interval(self, X, confidence=0.90):
        """Generates point forecast along with prediction interval using tree ensemble variance."""
        preds = self.model.predict(X)
        
        # Extract per-tree predictions to estimate forecast variance
        tree_preds = np.array([tree.predict(X.values if hasattr(X, "values") else X) for tree in self.model.estimators_])
        std = np.std(tree_preds, axis=0)
        
        # Z-score for confidence (e.g. 1.645 for 90% interval)
        z = 1.645 if confidence == 0.90 else 1.96
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
            filepath = self.artifacts_dir / f"rf_{self.crop_id}_{self.horizon_days}d.joblib"
        joblib.dump({"model": self.model, "features": self.feature_names, "params": self.best_params}, filepath)
        return filepath

    def load(self, filepath=None):
        if filepath is None:
            filepath = self.artifacts_dir / f"rf_{self.crop_id}_{self.horizon_days}d.joblib"
            if not filepath.exists():
                filepath = self.artifacts_dir / f"rf_{self.crop_id}_15d.joblib"
        data = joblib.load(filepath)
        self.model = data["model"]
        self.feature_names = data["features"]
        self.best_params = data.get("params", {})
        return self

