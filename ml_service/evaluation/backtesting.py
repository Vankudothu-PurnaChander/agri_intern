"""Rolling-Origin Walk-Forward Backtesting and Model Comparison Framework.
Evaluates forecasting algorithms chronologically without future leakage.
"""
import numpy as np
import pandas as pd
from ml_service.evaluation.metrics import calculate_metrics

class WalkForwardBacktester:
    def __init__(self, n_splits=5, horizon_days=15):
        self.n_splits = n_splits
        self.horizon_days = horizon_days
        
    def evaluate_model(self, model_class, df_features, feature_cols, target_col="target"):
        """Performs rolling-origin backtesting over expanding historical windows."""
        clean_df = df_features.dropna(subset=[target_col] + feature_cols).reset_index(drop=True)
        total_len = len(clean_df)
        
        # Need at least 200 samples for 5 walk-forward folds
        if total_len < 100:
            return {"mae": None, "rmse": None, "note": "Insufficient length for backtesting"}
            
        test_size = int(total_len * 0.15)
        step_size = test_size // self.n_splits
        start_origin = total_len - (self.n_splits * step_size)
        
        all_true = []
        all_pred = []
        all_base = []
        
        for i in range(self.n_splits):
            train_end = start_origin + (i * step_size)
            test_end = train_end + step_size
            
            train_df = clean_df.iloc[:train_end]
            test_df = clean_df.iloc[train_end:test_end]
            
            if len(test_df) == 0:
                continue
                
            X_tr, y_tr = train_df[feature_cols], train_df[target_col]
            X_te, y_te = test_df[feature_cols], test_df[target_col]
            
            # Train and predict
            clf = model_class()
            clf.fit(X_tr, y_tr)
            y_hat = clf.predict(X_te)
            
            all_true.extend(y_te.values)
            all_pred.extend(y_hat)
            all_base.extend(test_df["price_lag_1"].values)
            
        metrics = calculate_metrics(all_true, all_pred, y_base=all_base)
        metrics["folds"] = self.n_splits
        return metrics

