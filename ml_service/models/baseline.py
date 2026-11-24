"""Baseline Forecasting Models.
Establishes benchmark reference metrics using Last Observed, Moving Average, and Seasonal Naive.
"""
import numpy as np
import pandas as pd
from ml_service.evaluation.metrics import calculate_metrics

class BaselineForecaster:
    def __init__(self):
        pass
        
    def evaluate_last_observed(self, df_feat, horizon_days=15):
        """Predicts future price as the most recently observed modal price (P_t-1)."""
        valid = df_feat.dropna(subset=["target", "price_lag_1"])
        y_true = valid["target"].values
        y_pred = valid["price_lag_1"].values
        metrics = calculate_metrics(y_true, y_pred, y_base=valid["price_lag_1"].values)
        metrics["model_name"] = "Last Observed Baseline"
        return metrics, y_pred

    def evaluate_moving_average(self, df_feat, window=7, horizon_days=15):
        """Predicts future price as the rolling moving average of past prices."""
        col = f"price_rolling_mean_{window}" if f"price_rolling_mean_{window}" in df_feat.columns else "price_rolling_mean_7"
        valid = df_feat.dropna(subset=["target", col, "price_lag_1"])
        y_true = valid["target"].values
        y_pred = valid[col].values
        metrics = calculate_metrics(y_true, y_pred, y_base=valid["price_lag_1"].values)
        metrics["model_name"] = f"{window}-Day Moving Average Baseline"
        return metrics, y_pred

    def evaluate_seasonal_naive(self, df_feat, horizon_days=15):
        """Predicts future price using same day last year (t - 365) or season lag."""
        valid = df_feat.dropna(subset=["target", "price_lag_1"]).copy()
        # Fallback to 30-day lag if 365 is not yet reached
        y_pred = valid["price_lag_30"].fillna(valid["price_lag_1"]).values
        y_true = valid["target"].values
        metrics = calculate_metrics(y_true, y_pred, y_base=valid["price_lag_1"].values)
        metrics["model_name"] = "Seasonal Naive Baseline"
        return metrics, y_pred

